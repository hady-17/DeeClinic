export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'APPOINTMENT_CONFLICT'
  | 'BUSINESS_RULE'
  | 'RATE_LIMITED'
  | 'ACCOUNT_DISABLED'
  | 'INTERNAL';

export class AppError extends Error {
  /** For 429s: seconds until the caller may try again (sent as Retry-After) */
  retryAfter?: number;

  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static validation(message: string, details?: Record<string, unknown>) {
    return new AppError(400, 'VALIDATION_ERROR', message, details);
  }
  static unauthorized(message = 'Login required.') {
    return new AppError(401, 'UNAUTHORIZED', message);
  }
  static forbidden(message = 'You are not allowed to do this.') {
    return new AppError(403, 'FORBIDDEN', message);
  }
  static notFound(message = 'Not found.') {
    return new AppError(404, 'NOT_FOUND', message);
  }
  static conflict(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    return new AppError(409, code, message, details);
  }
  static tooManyRequests(message = 'Too many attempts. Please wait a few minutes and try again.') {
    return new AppError(429, 'RATE_LIMITED', message);
  }
  static accountDisabled(message = 'This account has been deactivated. Contact the clinic owner.') {
    return new AppError(403, 'ACCOUNT_DISABLED', message);
  }
  static businessRule(message: string, details?: Record<string, unknown>) {
    return new AppError(422, 'BUSINESS_RULE', message, details);
  }
}
