import { RMQ } from '@/config/rabbitmq';
import { RabbitMQService } from '@/shared/rabbitmq/rabbitmq.service';
import { getApprovalRequestEmailTemplate } from '@/shared/templates/mail/approval-request-email';
import { getApprovalRequestWhatsAppMessage } from '@/shared/templates/whatsapp/approval-request-whatsapp';
import { Injectable } from '@nestjs/common';
import { WhatsAppService } from '../services/whatsapp.service';
import { globalLogger as Logger } from './logger';
import { sendMail } from './smtp';

export interface EmailNotificationPayload {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

export interface PushNotificationPayload {
  userId: string;
  title: string;
  message: string;
  data?: Record<string, any>;
}

export interface ApprovalNotificationParams {
  approverId: string;
  approverName: string;
  approverEmail: string;
  approverPhone?: string;
  bookingDetails: {
    bookingNumber: string;
    requesterName: string;
    destination: string;
    date: string;
    purpose: string;
  };
  approveToken: string;
  rejectToken: string;
  channels: ('email' | 'push' | 'whatsapp')[];
}

@Injectable()
export class NotificationService {
  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly whatsappService: WhatsAppService,
  ) {}

  /**
   * Send email notification via RabbitMQ
   */
  async sendEmail(payload: EmailNotificationPayload): Promise<void> {
    try {
      await this.rabbitMQService.publish(RMQ.NOTIFICATION.exchange, RMQ.NOTIFICATION.routingKey, {
        type: 'email',
        ...payload,
      });
      Logger.info(`Email notification queued for ${payload.to}`, 'NotificationService.sendEmail');
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Failed to queue email notification',
        error instanceof Error ? error.stack : undefined,
        'NotificationService.sendEmail',
      );
      throw error;
    }
  }

  /**
   * Send push notification via OneSignal through RabbitMQ
   */
  async sendPushNotification(payload: PushNotificationPayload): Promise<void> {
    try {
      await this.rabbitMQService.publish(RMQ.NOTIFICATION.exchange, RMQ.NOTIFICATION.routingKey, {
        type: 'push',
        provider: 'onesignal',
        ...payload,
      });
      Logger.info(`Push notification queued for user ${payload.userId}`, 'NotificationService.sendPushNotification');
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Failed to queue push notification',
        error instanceof Error ? error.stack : undefined,
        'NotificationService.sendPushNotification',
      );
      throw error;
    }
  }

  /**
   * Send both email and push notification for booking submission
   * @deprecated Use sendApprovalNotification instead for actionable notifications with buttons
   */
  async sendBookingSubmissionNotifications(
    approverEmail: string,
    approverId: string,
    bookingNumber: string,
    requesterName: string,
    purpose: string,
  ): Promise<void> {
    try {
      // Send email notification
      await this.sendEmail({
        to: approverEmail,
        subject: `New Booking Request: ${bookingNumber}`,
        body: `You have a new booking request from ${requesterName}.\n\nBooking Number: ${bookingNumber}\nPurpose: ${purpose}\n\nPlease review and approve the booking.`,
        html: `
          <h2>New Booking Request</h2>
          <p>You have a new booking request that requires your approval.</p>
          <ul>
            <li><strong>Booking Number:</strong> ${bookingNumber}</li>
            <li><strong>Requester:</strong> ${requesterName}</li>
            <li><strong>Purpose:</strong> ${purpose}</li>
          </ul>
          <p>Please review and approve the booking.</p>
        `,
      });

      // Send push notification
      await this.sendPushNotification({
        userId: approverId,
        title: 'New Booking Request',
        message: `You have a new booking request from ${requesterName} (${bookingNumber})`,
        data: {
          type: 'booking_approval',
          bookingNumber,
          requesterName,
        },
      });

      Logger.info(
        `Booking submission notifications sent for ${bookingNumber} to approver ${approverId}`,
        'NotificationService.sendBookingSubmissionNotifications',
      );
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Failed to send booking submission notifications',
        error instanceof Error ? error.stack : undefined,
        'NotificationService.sendBookingSubmissionNotifications',
      );
      // Don't throw error - notification failure shouldn't block booking creation
    }
  }

  /**
   * Send multi-channel approval notification with action links
   * Supports Email, WhatsApp, and Push notifications
   */
  async sendApprovalNotification(params: ApprovalNotificationParams): Promise<void> {
    const frontendUrl = process.env.BASE_URL_WEB || 'http://localhost:3000';
    const approveLink = `${frontendUrl}/approval/confirm?token=${params.approveToken}`;
    const rejectLink = `${frontendUrl}/approval/reject?token=${params.rejectToken}`;

    const promises: Promise<any>[] = [];

    // Email notification
    if (params.channels.includes('email')) {
      const emailHtml = getApprovalRequestEmailTemplate({
        approverName: params.approverName,
        bookingNumber: params.bookingDetails.bookingNumber,
        requesterName: params.bookingDetails.requesterName,
        destination: params.bookingDetails.destination,
        date: params.bookingDetails.date,
        purpose: params.bookingDetails.purpose,
        approveLink,
        rejectLink,
      });

      promises.push(
        sendMail({
          to: [params.approverEmail],
          subject: `Permintaan Persetujuan: ${params.bookingDetails.bookingNumber}`,
          html: emailHtml,
        }).catch((error) => {
          Logger.error(
            `Failed to send approval email to ${params.approverEmail}`,
            error,
            'NotificationService.sendApprovalNotification',
          );
        }),
      );
    }

    // WhatsApp notification
    if (params.channels.includes('whatsapp') && params.approverPhone) {
      const whatsappMessage = getApprovalRequestWhatsAppMessage({
        approverName: params.approverName,
        bookingNumber: params.bookingDetails.bookingNumber,
        requesterName: params.bookingDetails.requesterName,
        destination: params.bookingDetails.destination,
        date: params.bookingDetails.date,
        purpose: params.bookingDetails.purpose,
        approveLink,
        rejectLink,
      });

      promises.push(
        this.whatsappService.sendMessage(params.approverPhone, whatsappMessage).catch((error) => {
          Logger.error(
            `Failed to send approval WhatsApp to ${params.approverPhone}`,
            error,
            'NotificationService.sendApprovalNotification',
          );
        }),
      );
    }

    // Push notification
    if (params.channels.includes('push')) {
      promises.push(
        this.sendPushNotification({
          userId: params.approverId,
          title: 'Permintaan Persetujuan Booking',
          message: `${params.bookingDetails.requesterName} meminta persetujuan untuk ${params.bookingDetails.destination}`,
          data: {
            type: 'booking_approval',
            bookingNumber: params.bookingDetails.bookingNumber,
            approveToken: params.approveToken,
            rejectToken: params.rejectToken,
          },
        }).catch((error) => {
          Logger.error(
            `Failed to send approval push notification to ${params.approverId}`,
            error,
            'NotificationService.sendApprovalNotification',
          );
        }),
      );
    }

    try {
      await Promise.allSettled(promises);
      Logger.info(
        `Approval notifications sent for ${params.bookingDetails.bookingNumber} via channels: ${params.channels.join(', ')}`,
        'NotificationService.sendApprovalNotification',
      );
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Failed to send approval notifications',
        error instanceof Error ? error.stack : undefined,
        'NotificationService.sendApprovalNotification',
      );
      // Don't throw - notification failures shouldn't block booking flow
    }
  }
}
