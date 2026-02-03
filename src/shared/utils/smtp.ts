import { globalLogger as Logger } from '@/shared/utils/logger';
import nodemailer from 'nodemailer';

interface SendMailProps {
  from?: string;
  to: Array<string>;
  subject: string;
  text?: string;
  html: string;
}

export const transporter = nodemailer.createTransport({
  host: process.env.NODEMAILER_HOST,
  port: parseInt(process.env.NODEMAILER_PORT || '587', 10),
  secure: true,
  auth: {
    user: process.env.NODEMAILER_USERNAME,
    pass: process.env.NODEMAILER_PASSWORD,
  },
});

export const sendMail = async ({ to, ...props }: SendMailProps) => {
  try {
    const info = await transporter.sendMail({
      ...props,
      from: process.env.EMAIL_SENDER,
      to: to.join(', '),
    });

    return !!info.messageId;
  } catch (error) {
    Logger.error(error, 'Error in sendMail');
    return false;
  }
};
