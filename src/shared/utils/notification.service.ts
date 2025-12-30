import { RMQ } from '@/config/rabbitmq';
import { RabbitMQService } from '@/shared/rabbitmq/rabbitmq.service';
import { Injectable } from '@nestjs/common';
import { globalLogger as Logger } from './logger';

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

@Injectable()
export class NotificationService {
  constructor(private readonly rabbitMQService: RabbitMQService) {}

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
}
