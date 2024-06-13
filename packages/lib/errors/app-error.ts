import { TRPCError } from '@trpc/server';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { TRPCClientError } from '@documenso/trpc/client';

/**
 * Generic application error codes.
 */
export enum AppErrorCode {
  'ALREADY_EXISTS' = 'AlreadyExists',
  'EXPIRED_CODE' = 'ExpiredCode',
  'INVALID_BODY' = 'InvalidBody',
  'INVALID_REQUEST' = 'InvalidRequest',
  'LIMIT_EXCEEDED' = 'LimitExceeded',
  'NOT_FOUND' = 'NotFound',
  'NOT_SETUP' = 'NotSetup',
  'UNAUTHORIZED' = 'Unauthorized',
  'UNKNOWN_ERROR' = 'UnknownError',
  'RETRY_EXCEPTION' = 'RetryException',
  'SCHEMA_FAILED' = 'SchemaFailed',
  'TOO_MANY_REQUESTS' = 'TooManyRequests',
  'PROFILE_URL_TAKEN' = 'ProfileUrlTaken',
  'PREMIUM_PROFILE_URL' = 'PremiumProfileUrl',
}

const genericErrorCodeToTrpcErrorCodeMap: Record<string, TRPCError['code']> = {
  [AppErrorCode.ALREADY_EXISTS]: 'BAD_REQUEST',
  [AppErrorCode.EXPIRED_CODE]: 'BAD_REQUEST',
  [AppErrorCode.INVALID_BODY]: 'BAD_REQUEST',
  [AppErrorCode.INVALID_REQUEST]: 'BAD_REQUEST',
  [AppErrorCode.NOT_FOUND]: 'NOT_FOUND',
  [AppErrorCode.NOT_SETUP]: 'BAD_REQUEST',
  [AppErrorCode.UNAUTHORIZED]: 'UNAUTHORIZED',
  [AppErrorCode.UNKNOWN_ERROR]: 'INTERNAL_SERVER_ERROR',
  [AppErrorCode.RETRY_EXCEPTION]: 'INTERNAL_SERVER_ERROR',
  [AppErrorCode.SCHEMA_FAILED]: 'INTERNAL_SERVER_ERROR',
  [AppErrorCode.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [AppErrorCode.PROFILE_URL_TAKEN]: 'BAD_REQUEST',
  [AppErrorCode.PREMIUM_PROFILE_URL]: 'BAD_REQUEST',
};

export const ZAppErrorJsonSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  userMessage: z.string().optional(),
});

export type TAppErrorJsonSchema = z.infer<typeof ZAppErrorJsonSchema>;

export class AppError extends Error {
  /**
   * The error code.
   */
  code: string;

  /**
   * An error message which can be displayed to the user.
   */
  userMessage?: string;

  /**
   * Create a new AppError.
   *
   * @param errorCode A string representing the error code.
   * @param message An internal error message.
   * @param userMessage A error message which can be displayed to the user.
   */
  public constructor(errorCode: string, message?: string, userMessage?: string) {
    super(message || errorCode);
    this.code = errorCode;
    this.userMessage = userMessage;
  }

  /**
   * Parse an unknown value into an AppError.
   *
   * @param error An unknown type.
   */
  static parseError(error: unknown): AppError {
    if (error instanceof AppError) {
      return error;
    }

    // Handle TRPC errors.
    if (error instanceof TRPCClientError) {
      const parsedJsonError = AppError.parseFromJSONString(error.message);
      return parsedJsonError || new AppError('UnknownError', error.message);
    }

    // Handle completely unknown errors.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const { code, message, userMessage } = error as {
      code: unknown;
      message: unknown;
      status: unknown;
      userMessage: unknown;
    };

    const validCode: string | null = typeof code === 'string' ? code : AppErrorCode.UNKNOWN_ERROR;
    const validMessage: string | undefined = typeof message === 'string' ? message : undefined;
    const validUserMessage: string | undefined =
      typeof userMessage === 'string' ? userMessage : undefined;

    return new AppError(validCode, validMessage, validUserMessage);
  }

  static parseErrorToTRPCError(error: unknown): TRPCError {
    const appError = AppError.parseError(error);

    return new TRPCError({
      code: genericErrorCodeToTrpcErrorCodeMap[appError.code] || 'BAD_REQUEST',
      message: AppError.toJSONString(appError),
    });
  }

  /**
   * Convert an AppError into a JSON object which represents the error.
   *
   * @param appError The AppError to convert to JSON.
   * @returns A JSON object representing the AppError.
   */
  static toJSON({ code, message, userMessage }: AppError): TAppErrorJsonSchema {
    return {
      code,
      message,
      userMessage,
    };
  }

  /**
   * Convert an AppError into a JSON string containing the relevant information.
   *
   * @param appError The AppError to stringify.
   * @returns A JSON string representing the AppError.
   */
  static toJSONString(appError: AppError): string {
    return JSON.stringify(AppError.toJSON(appError));
  }

  static parseFromJSONString(jsonString: string): AppError | null {
    try {
      const parsed = ZAppErrorJsonSchema.safeParse(JSON.parse(jsonString));

      if (!parsed.success) {
        return null;
      }

      return new AppError(parsed.data.code, parsed.data.message, parsed.data.userMessage);
    } catch {
      return null;
    }
  }

  static toRestAPIError(err: unknown): {
    status: 400 | 401 | 404 | 500;
    body: { message: string };
  } {
    const error = AppError.parseError(err);

    const status = match(error.code)
      .with(AppErrorCode.INVALID_BODY, AppErrorCode.INVALID_REQUEST, () => 400 as const)
      .with(AppErrorCode.UNAUTHORIZED, () => 401 as const)
      .with(AppErrorCode.NOT_FOUND, () => 404 as const)
      .otherwise(() => 500 as const);

    return {
      status,
      body: {
        message: status !== 500 ? error.message : 'Something went wrong',
      },
    };
  }
}
