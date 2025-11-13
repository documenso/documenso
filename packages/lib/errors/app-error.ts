import { match } from 'ts-pattern';
import { z } from 'zod';

/**
 * Generic application error codes.
 */
export enum AppErrorCode {
  'ALREADY_EXISTS' = 'ALREADY_EXISTS',
  'EXPIRED_CODE' = 'EXPIRED_CODE',
  'INVALID_BODY' = 'INVALID_BODY',
  'INVALID_REQUEST' = 'INVALID_REQUEST',
  'LIMIT_EXCEEDED' = 'LIMIT_EXCEEDED',
  'NOT_FOUND' = 'NOT_FOUND',
  'NOT_SETUP' = 'NOT_SETUP',
  'UNAUTHORIZED' = 'UNAUTHORIZED',
  'UNKNOWN_ERROR' = 'UNKNOWN_ERROR',
  'RETRY_EXCEPTION' = 'RETRY_EXCEPTION',
  'SCHEMA_FAILED' = 'SCHEMA_FAILED',
  'TOO_MANY_REQUESTS' = 'TOO_MANY_REQUESTS',
  'TWO_FACTOR_AUTH_FAILED' = 'TWO_FACTOR_AUTH_FAILED',
}

export const genericErrorCodeToTrpcErrorCodeMap: Record<string, { code: string; status: number }> =
  {
    [AppErrorCode.ALREADY_EXISTS]: { code: 'BAD_REQUEST', status: 400 },
    [AppErrorCode.EXPIRED_CODE]: { code: 'BAD_REQUEST', status: 400 },
    [AppErrorCode.INVALID_BODY]: { code: 'BAD_REQUEST', status: 400 },
    [AppErrorCode.INVALID_REQUEST]: { code: 'BAD_REQUEST', status: 400 },
    [AppErrorCode.NOT_FOUND]: { code: 'NOT_FOUND', status: 404 },
    [AppErrorCode.NOT_SETUP]: { code: 'BAD_REQUEST', status: 400 },
    [AppErrorCode.UNAUTHORIZED]: { code: 'UNAUTHORIZED', status: 401 },
    [AppErrorCode.UNKNOWN_ERROR]: { code: 'INTERNAL_SERVER_ERROR', status: 500 },
    [AppErrorCode.RETRY_EXCEPTION]: { code: 'INTERNAL_SERVER_ERROR', status: 500 },
    [AppErrorCode.SCHEMA_FAILED]: { code: 'INTERNAL_SERVER_ERROR', status: 500 },
    [AppErrorCode.TOO_MANY_REQUESTS]: { code: 'TOO_MANY_REQUESTS', status: 429 },
    [AppErrorCode.TWO_FACTOR_AUTH_FAILED]: { code: 'UNAUTHORIZED', status: 401 },
  };

export const ZAppErrorJsonSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  userMessage: z.string().optional(),
  statusCode: z.number().optional(),
});

export type TAppErrorJsonSchema = z.infer<typeof ZAppErrorJsonSchema>;

type AppErrorOptions = {
  /**
   * An internal message for logging.
   */
  message?: string;

  /**
   * A message which can be potientially displayed to the user.
   */
  userMessage?: string;

  /**
   * The status code to be associated with the error.
   *
   * Mainly used for API -> Frontend communication and logging filtering.
   */
  statusCode?: number;
};

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
   * The status code to be associated with the error.
   */
  statusCode?: number;

  name = 'AppError';

  /**
   * Create a new AppError.
   *
   * @param errorCode A string representing the error code.
   * @param message An internal error message.
   * @param userMessage A error message which can be displayed to the user.
   */
  public constructor(errorCode: string, options?: AppErrorOptions) {
    super(options?.message || errorCode);

    this.code = errorCode;
    this.userMessage = options?.userMessage;
    this.statusCode = options?.statusCode;
  }

  /**
   * Parse an unknown value into an AppError.
   *
   * @param error An unknown type.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static parseError(error: any): AppError {
    if (error instanceof AppError) {
      return error;
    }

    // Handle TRPC errors.
    if (error?.name === 'TRPCClientError') {
      const parsedJsonError = AppError.parseFromJSON(error.data?.appError);

      const fallbackError = new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: error?.message,
      });

      return parsedJsonError || fallbackError;
    }

    // Handle completely unknown errors.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const { code, message, userMessage, statusCode } = error as {
      code: unknown;
      message: unknown;
      statusCode: unknown;
      userMessage: unknown;
    };

    const validCode: string | null = typeof code === 'string' ? code : AppErrorCode.UNKNOWN_ERROR;
    const validMessage: string | undefined = typeof message === 'string' ? message : undefined;
    const validUserMessage: string | undefined =
      typeof userMessage === 'string' ? userMessage : undefined;

    const validStatusCode = typeof statusCode === 'number' ? statusCode : undefined;

    const options: AppErrorOptions = {
      message: validMessage,
      userMessage: validUserMessage,
      statusCode: validStatusCode,
    };

    return new AppError(validCode, options);
  }

  /**
   * Convert an AppError into a JSON object which represents the error.
   *
   * @param appError The AppError to convert to JSON.
   * @returns A JSON object representing the AppError.
   */
  static toJSON({ code, message, userMessage, statusCode }: AppError): TAppErrorJsonSchema {
    const data: TAppErrorJsonSchema = {
      code,
    };

    // Explicity only set values if it exists, since TRPC will add meta for undefined
    // values which clutters up API responses.
    if (message) {
      data.message = message;
    }

    if (userMessage) {
      data.userMessage = userMessage;
    }

    if (statusCode) {
      data.statusCode = statusCode;
    }

    return data;
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

  static parseFromJSON(value: unknown): AppError | null {
    try {
      const parsed = ZAppErrorJsonSchema.safeParse(value);

      if (!parsed.success) {
        return null;
      }

      const { message, userMessage, statusCode } = parsed.data;

      return new AppError(parsed.data.code, {
        message,
        userMessage,
        statusCode,
      });
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
