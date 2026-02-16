/**
 * Custom error classes for the LabFlow API.
 *
 * Each error maps to a specific HTTP status code and carries a machine-readable
 * `code` field that clients can use for programmatic error handling.
 */

export interface ErrorResponseBody {
  statusCode: number;
  error: string;
  code: string;
  message: string;
  details?: unknown;
}

export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    // Maintain proper stack traces in V8
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): ErrorResponseBody {
    const body: ErrorResponseBody = {
      statusCode: this.statusCode,
      error: this.name,
      code: this.code,
      message: this.message,
    };
    if (this.details !== undefined) {
      body.details = this.details;
    }
    return body;
  }
}

/**
 * 404 - The requested resource was not found.
 */
export class NotFoundError extends AppError {
  readonly statusCode = 404 as const;
  readonly code: string;

  constructor(resource: string, identifier?: string, details?: unknown) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' was not found`
      : `${resource} not found`;
    super(message, details);
    this.code = 'NOT_FOUND';
  }
}

/**
 * 401 - Authentication is required or has failed.
 */
export class UnauthorizedError extends AppError {
  readonly statusCode = 401 as const;
  readonly code: string;

  constructor(message = 'Authentication required', details?: unknown) {
    super(message, details);
    this.code = 'UNAUTHORIZED';
  }
}

/**
 * 403 - The authenticated user does not have permission.
 */
export class ForbiddenError extends AppError {
  readonly statusCode = 403 as const;
  readonly code: string;

  constructor(
    message = 'You do not have permission to perform this action',
    details?: unknown,
  ) {
    super(message, details);
    this.code = 'FORBIDDEN';
  }
}

/**
 * 400 - The request payload failed validation.
 */
export class ValidationError extends AppError {
  readonly statusCode = 400 as const;
  readonly code: string;

  constructor(
    message = 'Validation failed',
    details?: unknown,
  ) {
    super(message, details);
    this.code = 'VALIDATION_ERROR';
  }
}

/**
 * 409 - The request conflicts with the current state of the resource.
 */
export class ConflictError extends AppError {
  readonly statusCode = 409 as const;
  readonly code: string;

  constructor(
    message = 'Resource conflict',
    details?: unknown,
  ) {
    super(message, details);
    this.code = 'CONFLICT';
  }
}

/**
 * 429 - Rate limit exceeded.
 */
export class RateLimitError extends AppError {
  readonly statusCode = 429 as const;
  readonly code: string;

  constructor(
    message = 'Too many requests. Please try again later.',
    details?: unknown,
  ) {
    super(message, details);
    this.code = 'RATE_LIMIT_EXCEEDED';
  }
}

/**
 * 500 - An unexpected internal error occurred.
 */
export class InternalError extends AppError {
  readonly statusCode = 500 as const;
  readonly code: string;

  constructor(
    message = 'An internal server error occurred',
    details?: unknown,
  ) {
    super(message, details);
    this.code = 'INTERNAL_ERROR';
  }
}

/**
 * Type guard to check if an error is one of our AppError subclasses.
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
