import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode-terminal';
import { Client, LocalAuth } from 'whatsapp-web.js';
import { globalLogger as Logger } from '../utils/logger';

@Injectable()
export class WhatsAppService {
  private client: Client;
  private isReady: boolean = false;
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = process.env.WHATSAPP_ENABLED === 'true';

    if (!this.isEnabled) {
      Logger.info('WhatsApp service is disabled', 'WhatsAppService.constructor');
      return;
    }

    this.initializeClient();
  }

  private initializeClient() {
    try {
      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: process.env.WHATSAPP_SESSION_PATH || './whatsapp-session',
        }),
        puppeteer: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      });

      this.client.on('qr', (qr) => {
        Logger.info('WhatsApp QR Code generated. Scan to authenticate:', 'WhatsAppService');
        QRCode.generate(qr, { small: true });
      });

      this.client.on('ready', () => {
        this.isReady = true;
        Logger.info('WhatsApp client is ready!', 'WhatsAppService');
      });

      this.client.on('authenticated', () => {
        Logger.info('WhatsApp client authenticated', 'WhatsAppService');
      });

      this.client.on('auth_failure', (msg) => {
        Logger.error('WhatsApp authentication failed', msg, 'WhatsAppService');
      });

      this.client.on('disconnected', (reason) => {
        Logger.warn(`WhatsApp client disconnected: ${reason}`, 'WhatsAppService');
        this.isReady = false;
      });

      this.client.initialize();
      Logger.info('WhatsApp client initialization started', 'WhatsAppService.initializeClient');
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Failed to initialize WhatsApp client',
        error instanceof Error ? error.stack : undefined,
        'WhatsAppService.initializeClient',
      );
    }
  }

  /**
   * Send WhatsApp message to a phone number
   * @param phoneNumber - Phone number in international format (e.g., 628123456789)
   * @param message - Message text to send
   */
  async sendMessage(phoneNumber: string, message: string): Promise<boolean> {
    if (!this.isEnabled) {
      Logger.warn('WhatsApp service is disabled, skipping message send', 'WhatsAppService.sendMessage');
      return false;
    }

    if (!this.isReady) {
      Logger.warn('WhatsApp client is not ready, message queued or dropped', 'WhatsAppService.sendMessage');
      return false;
    }

    try {
      // Format phone number for WhatsApp (remove + and add @c.us)
      const formattedNumber = phoneNumber.replace(/\+/g, '') + '@c.us';

      Logger.info(`Sending WhatsApp message to ${phoneNumber}`, 'WhatsAppService.sendMessage');

      await this.client.sendMessage(formattedNumber, message);

      Logger.info(`WhatsApp message sent successfully to ${phoneNumber}`, 'WhatsAppService.sendMessage');
      return true;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : `Failed to send WhatsApp message to ${phoneNumber}`,
        error instanceof Error ? error.stack : undefined,
        'WhatsAppService.sendMessage',
      );
      return false;
    }
  }

  /**
   * Check if WhatsApp service is ready
   */
  isServiceReady(): boolean {
    return this.isReady && this.isEnabled;
  }

  /**
   * Get WhatsApp service status
   */
  getStatus(): { enabled: boolean; ready: boolean } {
    return {
      enabled: this.isEnabled,
      ready: this.isReady,
    };
  }
}
