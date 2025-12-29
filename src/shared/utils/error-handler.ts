import { HttpException, HttpStatus } from '@nestjs/common';
import { globalLogger } from './logger';

export class GlobalErrorHandler {
  static handle(error: any, context?: string): never {
    globalLogger.error(error.message || 'Unknown error', error.stack, context);

    if (error instanceof HttpException) {
      throw error;
    }

    throw new HttpException(error.message || 'Internal server error', error.status || HttpStatus.INTERNAL_SERVER_ERROR);
  }

  static async handleAsync<T>(operation: () => Promise<T>, context?: string): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.handle(error, context);
    }
  }
}

export const handleError = GlobalErrorHandler.handle;
export const handleAsyncError = GlobalErrorHandler.handleAsync;
