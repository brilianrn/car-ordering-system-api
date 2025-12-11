import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

const appID = (process.env.APP_ID ?? '').toString();

const timestamp = Date.now();

const key = new Uint8Array(Buffer.from(appID, 'utf8'));
const message = new Uint8Array(Buffer.from(`gposlitehub:${appID}:ptgue:${timestamp}`, 'utf8'));

const hmac = crypto.createHmac('sha256', key);
const signature = hmac.update(message).digest('hex');

const http: AxiosInstance = axios.create({
  baseURL: process.env.API_URL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-API-Key': signature.toString(),
    'X-Timestamp': timestamp.toString(),
  },
  timeout: parseInt(process.env.NEXT_PUBLIC_TIMEOUT ?? '60000'),
});

export const dataStoreApi = http;
