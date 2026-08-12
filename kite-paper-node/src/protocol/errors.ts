/**
 * Error factory — produces kiteconnect-compatible error bodies.
 */

import { KiteError, type ErrorType } from '../types';

/** Map an error type to its HTTP status code. */
export function errorHttpStatus(errorType: ErrorType): number {
  switch (errorType) {
    case 'InputException':
      return 400;
    case 'TokenException':
      return 403;
    case 'PermissionException':
      return 403;
    case 'MarginException':
      return 400;
    case 'OrderException':
      return 400;
    case 'NetworkException':
      return 404;
    case 'GeneralException':
    default:
      return 500;
  }
}

/** Create a KiteError with the correct HTTP status. */
export function createError(errorType: ErrorType, message: string): KiteError {
  return new KiteError(errorType, message, errorHttpStatus(errorType));
}

/** Convenience factories. */
export const errors = {
  input(message: string): KiteError {
    return createError('InputException', message);
  },
  network(message: string): KiteError {
    return createError('NetworkException', message);
  },
  order(message: string): KiteError {
    return createError('OrderException', message);
  },
  margin(message: string): KiteError {
    return createError('MarginException', message);
  },
  token(message: string): KiteError {
    return createError('TokenException', message);
  },
  permission(message: string): KiteError {
    return createError('PermissionException', message);
  },
  general(message: string): KiteError {
    return createError('GeneralException', message);
  },
};
