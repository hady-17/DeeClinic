export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'APPOINTMENT_CONFLICT'
  | 'BUSINESS_RULE'
  | 'INTERNAL';

export class AppError extends Error {
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
  static businessRule(message: string, details?: Record<string, unknown>) {
    return new AppError(422, 'BUSINESS_RULE', message, details);
  }
}
