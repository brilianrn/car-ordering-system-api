import { validationMessage } from '@/shared/constants';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { serializeParam } from '../serialize';
import { RequestAPI, ResponseREST } from './types';

export const http: AxiosInstance = axios.create({
  baseURL: process.env.BASE_API_URL,
  timeout: parseInt(process.env.TIMEOUT ?? '60000'),
});

export class RestAPI implements RequestAPI {
  private http: AxiosInstance;
  private httpDefault: AxiosInstance = axios.create({
    timeout: parseInt(process.env.TIMEOUT ?? '60000'),
  });

  constructor(http?: AxiosInstance, token?: string) {
    this.http = http ?? this.httpDefault;
    if (token) {
      this.http.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }

  async get<T extends Partial<object>>({
    endpoint,
    config,
    queryParam,
  }: {
    endpoint: string;
    queryParam?: object;
    config?: AxiosRequestConfig;
  }): Promise<ResponseREST<T>> {
    try {
      let url = endpoint;

      if (queryParam && Object.keys(queryParam).length > 0) {
        url = url + '?' + serializeParam(queryParam);
      }

      const res = await this.http.get(url, {
        ...config,
        baseURL: config?.baseURL || process.env.BASE_API_URL,
      });

      if (res.status !== 200) {
        const response = { ...res.data, code: 5000 };
        return response;
      }

      return res.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const errData: ResponseREST<T> = error.response?.data;
        if (error?.code === 'ECONNABORTED') {
          return { code: 408, message: validationMessage()[408]() };
        }
        return { code: errData.code, message: errData.message };
      }
      return { code: 500, message: validationMessage()[500]() };
    }
  }

  async post<T extends Partial<object> | void>({
    endpoint,
    body,
    config,
    queryParam,
  }: {
    endpoint: string;
    body?: object;
    queryParam?: object;
    config?: AxiosRequestConfig;
  }): Promise<ResponseREST<T>> {
    try {
      let url = endpoint;

      if (queryParam && Object.keys(queryParam).length > 0) {
        url = url + '?' + serializeParam(queryParam);
      }

      const res = await this.http.post(url, body, {
        ...config,
        baseURL: config?.baseURL || process.env.BASE_API_URL,
      });

      if (res.status !== 200) {
        const response = { ...res.data, code: 5000 };
        return response;
      }

      return res.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const errData: ResponseREST<T> = error.response?.data;
        if (error?.code === 'ECONNABORTED') {
          return { code: 408, message: validationMessage()[408]() };
        }
        return {
          code: errData.code,
          message: errData.message,
          data: errData.data,
        };
      }
      return { code: 500, message: validationMessage()[500]() };
    }
  }

  async put<T extends Partial<object> | void>({
    endpoint,
    body,
    config,
    queryParam,
  }: {
    endpoint: string;
    body?: object;
    queryParam?: object;
    config?: AxiosRequestConfig;
  }): Promise<ResponseREST<T>> {
    try {
      let url = endpoint;

      if (queryParam && Object.keys(queryParam).length > 0) {
        url = url + '?' + serializeParam(queryParam);
      }

      const res = await this.http.put(url, body, {
        ...config,
        baseURL: config?.baseURL || process.env.BASE_API_URL,
      });

      if (res.status !== 200) {
        const response = { ...res.data, code: 5000 };
        return response;
      }

      return res.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const errData: ResponseREST<T> = error.response?.data;
        if (error?.code === 'ECONNABORTED') {
          return { code: 408, message: validationMessage()[408]() };
        }
        return { code: errData.code, message: errData.message };
      }
      return { code: 500, message: validationMessage()[500]() };
    }
  }

  async patch<T extends Partial<object> | void>({
    endpoint,
    body,
    config,
    queryParam,
  }: {
    endpoint: string;
    body?: object;
    queryParam?: object;
    config?: AxiosRequestConfig;
  }): Promise<ResponseREST<T>> {
    try {
      let url = endpoint;

      if (queryParam && Object.keys(queryParam).length > 0) {
        url = url + '?' + serializeParam(queryParam);
      }

      const res = await this.http.patch(url, body, {
        ...config,
        baseURL: config?.baseURL || process.env.BASE_API_URL,
      });

      if (res.status !== 200) {
        const response = { ...res.data, code: 5000 };
        return response;
      }

      return res.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const errData: ResponseREST<T> = error.response?.data;
        if (error?.code === 'ECONNABORTED') {
          return { code: 408, message: validationMessage()[408]() };
        }
        return { code: errData.code, message: errData.message };
      }
      return { code: 500, message: validationMessage()[500]() };
    }
  }

  async delete<T extends Partial<object> | void>({
    endpoint,
    bodyparam,
    config,
    queryParam,
  }: {
    endpoint: string;
    bodyparam?: unknown;
    queryParam?: object;
    config?: AxiosRequestConfig;
  }): Promise<ResponseREST<T>> {
    try {
      let url = endpoint;

      if (queryParam && Object.keys(queryParam).length > 0) {
        url = url + '?' + serializeParam(queryParam);
      }

      const axiosConfig: AxiosRequestConfig = {
        ...config,
        data: bodyparam,
      };

      const res = await this.http.delete(url, {
        ...axiosConfig,
        baseURL: config?.baseURL || process.env.BASE_API_URL,
      });

      if (res.status !== 200) {
        const response = { ...res.data, code: 5000 };
        return response;
      }

      return res.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const errData: ResponseREST<T> = error.response?.data;
        if (error?.code === 'ECONNABORTED') {
          return { code: 408, message: validationMessage()[408]() };
        }
        return { code: errData.code, message: errData.message };
      }
      return { code: 500, message: validationMessage()[500]() };
    }
  }
}
