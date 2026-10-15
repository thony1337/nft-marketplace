import axios from 'axios';
import type { ApiErrorBody } from '../types';

// One shape for every failure, whatever its origin (server error body, no network, timeout)
export class ApiError extends Error {
  readonly status: number; // 0 when there was no HTTP response
  readonly code: string;
  readonly fieldErrors?: Record<string, string>;

  constructor(status: number, code: string, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  get isNetworkError() {
    return this.code === 'NETWORK_ERROR';
  }
  get isTimeout() {
    return this.code === 'TIMEOUT';
  }
  // Worth offering "try again": the request may well succeed next time
  get isRetryable() {
    return this.status === 0 || this.status === 408 || this.status === 429 || this.status >= 500;
  }
  get isSessionProblem() {
    return this.code === 'SESSION_EXPIRED' || this.code === 'UNAUTHENTICATED';
  }
}

const isBody = (data: unknown): data is ApiErrorBody =>
  typeof data === 'object' && data !== null && typeof (data as ApiErrorBody).code === 'string' &&
  typeof (data as ApiErrorBody).message === 'string';

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isAxiosError(error)) {
    const { response } = error;
    if (response) {
      if (isBody(response.data)) {
        const { code, message, fieldErrors } = response.data;
        return new ApiError(response.status, code, message, fieldErrors);
      }
      return new ApiError(
        response.status,
        response.status >= 500 ? 'SERVER_ERROR' : 'REQUEST_FAILED',
        response.status >= 500 ? 'O servidor não conseguiu responder agora.' : 'Não foi possível concluir a solicitação.',
      );
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError(0, 'TIMEOUT', 'A requisição demorou demais para responder.');
    }
    return new ApiError(0, 'NETWORK_ERROR', 'Sem conexão com o servidor. Verifique sua internet.');
  }

  return new ApiError(0, 'UNKNOWN', error instanceof Error ? error.message : 'Algo deu errado.');
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;
