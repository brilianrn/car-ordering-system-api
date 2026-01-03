import { Injectable } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { BookingStatus } from '@prisma/client';
import { CarpoolConsentStatus } from '../dto/respond-invite.dto';
import { CarpoolRepository } from '../repository/carpool.repository';
import { CarpoolCandidateMatcherService } from '../services/carpool-candidate-matcher.service';
import { CarpoolMergeEngineService } from '../services/carpool-merge-engine.service';
import { CarpoolCostAllocatorService } from '../services/carpool-cost-allocator.service';
import { CarpoolAuditService } from '../services/carpool-audit.service';
import { CarpoolConfigService } from '../services/carpool-config.service';
import {
  FindCandidatesDto,
  FindCandidatesPreSubmitDto,
  InviteCarpoolDto,
  RespondInviteDto,
  MergeCarpoolDto,
  UnmergeCarpoolDto,
} from '../dto';
import { ICarpoolCandidate, ICarpoolInviteResponse, ICarpoolGroupResponse } from '../domain/response';

@Injectable()
export class CarpoolUseCase {
  constructor(
    private readonly repository: CarpoolRepository,
    private readonly candidateMatcher: CarpoolCandidateMatcherService,
    private readonly mergeEngine: CarpoolMergeEngineService,
    private readonly costAllocator: CarpoolCostAllocatorService,
    private readonly auditService: CarpoolAuditService,
    private readonly configService: CarpoolConfigService,
  ) {}

  /**
   * Find carpool candidates for a host booking
   */
  async findCandidates(dto: FindCandidatesDto, userId: string): Promise<IUsecaseResponse<ICarpoolCandidate[]>> {
    try {
      const candidates = await this.candidateMatcher.findCandidates(dto.hostBookingId);

      // Log MATCHED action
      await this.auditService.logAction({
        hostBookingId: dto.hostBookingId,
        actionType: 'MATCHED',
        userId,
        metadata: {
          candidateCount: candidates.length,
        },
      });

      return { data: candidates };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error finding candidates',
        error instanceof Error ? error.stack : undefined,
        'CarpoolUseCase.findCandidates',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to find candidates',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }

  /**
   * Find carpool candidates for a pre-submit booking (before booking is created)
   * This is used when user is filling the booking form and wants to see carpool recommendations
   */
  async findCandidatesPreSubmit(
    dto: FindCandidatesPreSubmitDto,
    userId: string,
  ): Promise<IUsecaseResponse<ICarpoolCandidate[]>> {
    try {
      const candidates = await this.candidateMatcher.findCandidatesPreSubmit({
        startAt: dto.startAt,
        endAt: dto.endAt,
        passengerCount: dto.passengerCount,
        segment: {
          from: dto.segment.from,
          to: dto.segment.to,
          originLatLong: dto.segment.originLatLong,
          destinationLatLong: dto.segment.destinationLatLong,
          originNote: dto.segment.originNote,
          destinationNote: dto.segment.destinationNote,
        },
        requesterId: dto.requesterId || userId,
      });

      // Log MATCHED action (without hostBookingId since booking doesn't exist yet)
      await this.auditService.logAction({
        actionType: 'MATCHED',
        userId,
        metadata: {
          candidateCount: candidates.length,
          isPreSubmit: true,
        },
      });

      return { data: candidates };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error finding pre-submit candidates',
        error instanceof Error ? error.stack : undefined,
        'CarpoolUseCase.findCandidatesPreSubmit',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to find candidates',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }

  /**
   * Invite a booking to join carpool
   */
  async inviteCarpool(dto: InviteCarpoolDto, userId: string): Promise<IUsecaseResponse<ICarpoolInviteResponse>> {
    try {
      // Validate host booking
      const hostBooking = await this.repository.findBookingById(dto.hostBookingId);
      if (!hostBooking) {
        return {
          error: {
            message: `Host booking with ID ${dto.hostBookingId} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      if (hostBooking.bookingStatus === BookingStatus.MERGED) {
        return {
          error: {
            message: 'Host booking is already merged',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // Validate joiner booking
      const joinerBooking = await this.repository.findBookingById(dto.joinerBookingId);
      if (!joinerBooking) {
        return {
          error: {
            message: `Joiner booking with ID ${dto.joinerBookingId} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      if (joinerBooking.bookingStatus === BookingStatus.MERGED) {
        return {
          error: {
            message: 'Joiner booking is already merged',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // Get or create carpool group
      let carpoolGroup = await this.repository.findCarpoolGroupById(hostBooking.carpoolGroupId || 0);

      if (!carpoolGroup && !hostBooking.carpoolGroupId) {
        // Create new carpool group
        carpoolGroup = await this.repository.createCarpoolGroup({
          hostBooking: {
            connect: { id: dto.hostBookingId },
          },
          status: 'Active',
          createdBy: userId,
        });
      }

      // Check if invite already exists for this joiner booking
      // Note: This check should query by joinerBookingId, but for now we'll create new invite
      // TODO: Add proper duplicate invite check

      // Get config for expiry
      const config = await this.configService.getConfig();
      const expiresInMinutes = dto.expiresInMinutes || config.defaultInviteExpiryMinutes;
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

      // Create invite
      const invite = await this.repository.createInvite({
        carpoolGroup: {
          connect: { id: carpoolGroup.id },
        },
        joinerBooking: {
          connect: { id: dto.joinerBookingId },
        },
        hostBooking: {
          connect: { id: dto.hostBookingId },
        },
        consentStatus: 'PENDING',
        expiresAt,
        createdBy: userId,
      });

      // Log INVITE action
      await this.auditService.logAction({
        carpoolGroupId: carpoolGroup.id,
        hostBookingId: dto.hostBookingId,
        joinerBookingId: dto.joinerBookingId,
        actionType: 'INVITE',
        userId,
        newValue: {
          inviteId: invite.id,
          expiresAt: invite.expiresAt,
        },
      });

      return { data: invite as ICarpoolInviteResponse };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error inviting to carpool',
        error instanceof Error ? error.stack : undefined,
        'CarpoolUseCase.inviteCarpool',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to invite to carpool',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }

  /**
   * Respond to carpool invite (approve or decline)
   */
  async respondInvite(dto: RespondInviteDto, userId: string): Promise<IUsecaseResponse<ICarpoolInviteResponse>> {
    try {
      const invite = await this.repository.findInviteById(dto.inviteId);
      if (!invite) {
        return {
          error: {
            message: `Invite with ID ${dto.inviteId} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // Check if invite is expired
      if (invite.expiresAt && invite.expiresAt < new Date()) {
        await this.repository.updateInvite(dto.inviteId, {
          consentStatus: CarpoolConsentStatus.EXPIRED,
          updatedBy: userId,
        });

        return {
          error: {
            message: 'Invite has expired',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // Update invite
      const updatedInvite = await this.repository.updateInvite(dto.inviteId, {
        consentStatus: dto.consentStatus,
        respondedAt: new Date(),
        updatedBy: userId,
      });

      // Log action
      await this.auditService.logAction({
        carpoolGroupId: invite.carpoolGroupId,
        hostBookingId: invite.hostBookingId,
        joinerBookingId: invite.joinerBookingId,
        actionType: dto.consentStatus === CarpoolConsentStatus.APPROVED ? 'APPROVE' : 'DECLINE',
        userId,
        oldValue: {
          consentStatus: invite.consentStatus,
        },
        newValue: {
          consentStatus: dto.consentStatus,
        },
      });

      return { data: updatedInvite as ICarpoolInviteResponse };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error responding to invite',
        error instanceof Error ? error.stack : undefined,
        'CarpoolUseCase.respondInvite',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to respond to invite',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }

  /**
   * Merge carpool group
   */
  async mergeCarpool(dto: MergeCarpoolDto, userId: string): Promise<IUsecaseResponse<ICarpoolGroupResponse>> {
    try {
      // Merge bookings
      await this.mergeEngine.mergeCarpool(dto.carpoolGroupId, userId);

      // Calculate and allocate cost
      await this.costAllocator.calculateAndAllocateCost(dto.carpoolGroupId, dto.costMode, userId);

      // Get updated carpool group
      const carpoolGroup = await this.repository.findCarpoolGroupById(dto.carpoolGroupId);

      return { data: carpoolGroup as ICarpoolGroupResponse };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error merging carpool',
        error instanceof Error ? error.stack : undefined,
        'CarpoolUseCase.mergeCarpool',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to merge carpool',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }

  /**
   * Unmerge carpool group
   */
  async unmergeCarpool(dto: UnmergeCarpoolDto, userId: string): Promise<IUsecaseResponse<ICarpoolGroupResponse>> {
    try {
      const carpoolGroup = await this.repository.findCarpoolGroupById(dto.carpoolGroupId);
      if (!carpoolGroup) {
        return {
          error: {
            message: `Carpool group with ID ${dto.carpoolGroupId} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // Use transaction to unmerge
      const { clientDb } = await import('@/shared/utils');
      await clientDb.$transaction(async (tx) => {
        // Update host booking status
        await tx.booking.update({
          where: { id: carpoolGroup.hostBookingId },
          data: {
            bookingStatus: BookingStatus.SUBMITTED, // Revert to previous status
            carpoolGroupId: null,
            updatedBy: userId,
          },
        });

        // Update member bookings
        for (const member of carpoolGroup.memberBookings) {
          await tx.booking.update({
            where: { id: member.id },
            data: {
              bookingStatus: BookingStatus.SUBMITTED,
              carpoolGroupId: null,
              updatedBy: userId,
            },
          });
        }

        // Update carpool group status
        await tx.carpoolGroup.update({
          where: { id: dto.carpoolGroupId },
          data: {
            status: 'Unmerged',
            updatedBy: userId,
          },
        });
      });

      // Log UNMERGE action
      await this.auditService.logAction({
        carpoolGroupId: dto.carpoolGroupId,
        actionType: 'UNMERGE',
        userId,
        oldValue: {
          status: carpoolGroup.status,
        },
        newValue: {
          status: 'Unmerged',
        },
      });

      const updatedGroup = await this.repository.findCarpoolGroupById(dto.carpoolGroupId);
      return { data: updatedGroup as ICarpoolGroupResponse };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error unmerging carpool',
        error instanceof Error ? error.stack : undefined,
        'CarpoolUseCase.unmergeCarpool',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to unmerge carpool',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }
}
