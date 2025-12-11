import { HttpStatus } from '@nestjs/common';
import { AxiosRequestConfig } from 'axios';

export interface RequestAPI {
  get: (payload: {
    endpoint: string;
    queryParam?: object;
    config?: AxiosRequestConfig;
  }) => Promise<ResponseREST>;
  post: (payload: {
    endpoint: string;
    body?: object;
    queryParam?: object;
    config?: AxiosRequestConfig;
  }) => Promise<ResponseREST>;
  put: (payload: {
    endpoint: string;
    body?: object;
    queryParam?: object;
    config?: AxiosRequestConfig;
  }) => Promise<ResponseREST>;
  patch: (payload: {
    endpoint: string;
    body?: object;
    queryParam?: object;
    config?: AxiosRequestConfig;
  }) => Promise<ResponseREST>;
  delete: (payload: {
    endpoint: string;
    bodyparam?: object;
    queryParam?: object;
    config?: AxiosRequestConfig;
  }) => Promise<ResponseREST>;
}

export interface ResponseREST<T extends Partial<object> | undefined | void> {
  code?: HttpStatus;
  message: string;
  data?: T;
}

export interface IUseCaseInfiniteScroll<T extends object> {
  data?: T;
  prevPage: number;
}

export type IQueryParams = {
  limit: number;
  take?: number;
  page: number;
  search?: string;
  isDropdown?: boolean;
  sortBy?: string;
  ascDesc?: 'asc' | 'desc';
};

export interface ConfigService {
  Authorization: string;
  [key: string]: string | number | object | boolean;
}
