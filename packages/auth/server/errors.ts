import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { AuthenticationErrorCode } from './error-codes';
import { getErrorStatus } from './error-codes';

interface ErrorResponse {
  error: string;
  message: string;
  stack?: string;
}

export class AuthenticationError extends Error {
  code: AuthenticationErrorCode;
  statusCode: ContentfulStatusCode;

  constructor(code: AuthenticationErrorCode, message?: string, statusCode?: ContentfulStatusCode) {
    super(message);
    this.code = code;
    this.name = 'AuthenticationError';
    // Use provided status code or look it up from the map
    this.statusCode = statusCode ?? getErrorStatus(code);
  }

  toJSON(): ErrorResponse {
    return {
      error: this.code,
      message: this.message,
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack }),
    };
  }

  toHonoResponse(c: Context) {
    return c.json(
      {
        success: false,
        ...this.toJSON(),
      },
      this.statusCode,
    );
  }
}
