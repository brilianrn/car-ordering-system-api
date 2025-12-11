import { validationMessage } from '@/shared/constants';
import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ResponseREST } from './types';

export const response = {
  [HttpStatus.OK]: <T extends Partial<object>>(
    response: Response,
    { code, message, data }: ResponseREST<T>,
  ) => {
    return response.status(HttpStatus.OK).json({
      code: code || HttpStatus.OK,
      message: message || 'Sukses!',
      data,
    });
  },
  [HttpStatus.CREATED]: <T extends Partial<object>>(
    response: Response,
    { code, message, data }: ResponseREST<T>,
  ) => {
    return response.status(HttpStatus.CREATED).json({
      code: code || HttpStatus.CREATED,
      message: message || 'Berhasil dibuat!',
      data,
    });
  },
  [HttpStatus.BAD_REQUEST]: <T extends Partial<object>>(
    response: Response,
    { code, message, data }: ResponseREST<T>,
  ) => {
    return response.status(HttpStatus.BAD_REQUEST).json({
      code: code || HttpStatus.BAD_REQUEST,
      message: message || 'Tidak valid!',
      data,
    });
  },
  [HttpStatus.UNAUTHORIZED]: <T extends Partial<object>>(
    response: Response,
    { code, message, data }: ResponseREST<T>,
  ) => {
    return response.status(HttpStatus.UNAUTHORIZED).json({
      code: code || HttpStatus.UNAUTHORIZED,
      message: message || 'Tidak diizinkan!',
      data,
    });
  },
  [HttpStatus.FORBIDDEN]: <T extends Partial<object>>(
    response: Response,
    { code, message, data }: ResponseREST<T>,
  ) => {
    return response.status(HttpStatus.FORBIDDEN).json({
      code: code || HttpStatus.FORBIDDEN,
      message: message || 'Gagal!',
      data,
    });
  },
  [HttpStatus.NOT_FOUND]: <T extends Partial<object>>(
    response: Response,
    { code, message, data }: ResponseREST<T>,
  ) => {
    return response.status(HttpStatus.NOT_FOUND).json({
      code: code || HttpStatus.NOT_FOUND,
      message: message || 'Tidak ditemukan!',
      data,
    });
  },
  [HttpStatus.INTERNAL_SERVER_ERROR]: <T extends Partial<object>>(
    response: Response,
    payload?: ResponseREST<T>,
  ) => {
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: HttpStatus.INTERNAL_SERVER_ERROR,
      message: payload?.message || validationMessage()[500],
    });
  },
};
