import { Injectable } from '@nestjs/common';
import * as OneSignal from 'onesignal-node';
import { globalLogger as Logger } from '../utils/logger';

@Injectable()
export class OneSignalService {
  private readonly client: OneSignal.Client;

  constructor() {
    const appId = process.env.ONESIGNAL_APP_ID;
    const apiKey = process.env.ONESIGNAL_API_KEY;

    if (!appId || !apiKey) {
      Logger.error(
        'OneSignal App ID or API Key is missing. Please check your .env file.',
        undefined,
        'OneSignalService.constructor',
      );
      throw new Error('OneSignal configuration is missing. Please set ONESIGNAL_APP_ID and ONESIGNAL_API_KEY in .env');
    }

    this.client = new OneSignal.Client(appId, apiKey);
    Logger.info('OneSignal service initialized', 'OneSignalService.constructor');
  }

  /**
   * Send push notification to a specific user
   * @param userId - External user ID (user identifier in your system)
   * @param title - Notification title
   * @param message - Notification message/body
   * @param data - Optional additional data to send with notification
   * @returns Promise with notification response
   */
  async sendNotifToUser(userId: string, title: string, message: string, data?: Record<string, any>): Promise<any> {
    try {
      Logger.info(`Sending OneSignal notification to user: ${userId}`, 'OneSignalService.sendNotifToUser');

      const notification = {
        contents: {
          en: message,
        },
        headings: {
          en: title,
        },
        include_external_user_ids: [userId],
        ...(data && { data }),
      };

      const response = await this.client.createNotification(notification);

      Logger.info(
        `OneSignal notification sent successfully to user ${userId}. Response: ${JSON.stringify(response)}`,
        'OneSignalService.sendNotifToUser',
      );

      return response;
    } catch (error) {
      Logger.error(
        `Failed to send OneSignal notification to user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
        'OneSignalService.sendNotifToUser',
      );

      // Log full error response if available
      if (error && typeof error === 'object' && 'body' in error) {
        Logger.error(
          `OneSignal error response: ${JSON.stringify(error.body)}`,
          undefined,
          'OneSignalService.sendNotifToUser',
        );
      }

      throw error;
    }
  }

  /**
   * Send push notification to all users (broadcast)
   * @param title - Notification title
   * @param message - Notification message/body
   * @param data - Optional additional data to send with notification
   * @returns Promise with notification response
   */
  async sendNotifToAll(title: string, message: string, data?: Record<string, any>): Promise<any> {
    try {
      Logger.info('Sending OneSignal broadcast notification to all users', 'OneSignalService.sendNotifToAll');

      const notification = {
        contents: {
          en: message,
        },
        headings: {
          en: title,
        },
        included_segments: ['All'], // Send to all users
        ...(data && { data }),
      };

      const response = await this.client.createNotification(notification);

      Logger.info(
        `OneSignal broadcast notification sent successfully. Response: ${JSON.stringify(response)}`,
        'OneSignalService.sendNotifToAll',
      );

      return response;
    } catch (error) {
      Logger.error(
        `Failed to send OneSignal broadcast notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
        'OneSignalService.sendNotifToAll',
      );

      // Log full error response if available
      if (error && typeof error === 'object' && 'body' in error) {
        Logger.error(
          `OneSignal error response: ${JSON.stringify(error.body)}`,
          undefined,
          'OneSignalService.sendNotifToAll',
        );
      }

      throw error;
    }
  }
}
