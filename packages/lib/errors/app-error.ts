import { match } from 'ts-pattern';
import { z } from 'zod';

/**
 * Generic application error codes.
 */
export enum AppErrorCode {
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  EXPIRED_CODE = 'EXPIRED_CODE',
  INVALID_BODY = 'INVALID_BODY',
  INVALID_REQUEST = 'INVALID_REQUEST',
  RECIPIENT_EXPIRED = 'RECIPIENT_EXPIRED',
  LIMIT_EXCEEDED = 'LIMIT_EXCEEDED',
  NOT_FOUND = 'NOT_FOUND',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  NOT_SETUP = 'NOT_SETUP',
  MISSING_ENV_VAR = 'MISSING_ENV_VAR',
  INVALID_CAPTCHA = 'INVALID_CAPTCHA',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  RETRY_EXCEPTION = 'RETRY_EXCEPTION',
  SCHEMA_FAILED = 'SCHEMA_FAILED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  TWO_FACTOR_AUTH_FAILED = 'TWO_FACTOR_AUTH_FAILED',
  WEBHOOK_INVALID_REQUEST = 'WEBHOOK_INVALID_REQUEST',
  ENVELOPE_DRAFT = 'ENVELOPE_DRAFT',
  ENVELOPE_COMPLETED = 'ENVELOPE_COMPLETED',
  ENVELOPE_REJECTED = 'ENVELOPE_REJECTED',
  ENVELOPE_CANCELLED = 'ENVELOPE_CANCELLED',
  ENVELOPE_LEGACY = 'ENVELOPE_LEGACY',
  /**
   * Authoring mutation rejected because the envelope is an AES/QES envelope
   * past DRAFT — the TSP mutation lock fires at distribution to preserve
   * WYSIWYS. SES envelopes never hit this code.
   */
  ENVELOPE_TSP_LOCKED = 'ENVELOPE_TSP_LOCKED',

  /**
   * CSC (Cloud Signature Consortium) error codes. See the CSC QES V1 spec
   * for the recovery taxonomy.
   */
  CSC_INSTANCE_MODE_MISMATCH = 'CSC_INSTANCE_MODE_MISMATCH',
  CSC_UNLICENSED = 'CSC_UNLICENSED',
  CSC_PROVIDER_INFO_FAILED = 'CSC_PROVIDER_INFO_FAILED',
  CSC_PROVIDER_NO_TSA = 'CSC_PROVIDER_NO_TSA',
  CSC_CREDENTIAL_LIST_EMPTY = 'CSC_CREDENTIAL_LIST_EMPTY',
  CSC_CERT_INVALID = 'CSC_CERT_INVALID',
  CSC_ALGORITHM_REFUSED = 'CSC_ALGORITHM_REFUSED',
  CSC_SAD_EXPIRED_PRE_SIGN = 'CSC_SAD_EXPIRED_PRE_SIGN',
  CSC_TSP_TIMEOUT = 'CSC_TSP_TIMEOUT',
  CSC_EMBED_FAILED = 'CSC_EMBED_FAILED',
  CSC_BASE_DOCUMENT_MUTATED = 'CSC_BASE_DOCUMENT_MUTATED',
  /**
   * Generic catch-all for CSC HTTP transport failures — network error, non-2xx
   * response without a more specific semantic match, malformed JSON, or
   * response schema mismatch. Carries the TSP's HTTP status in `statusCode`
   * and the TSP's `error` / `error_description` in the message when available.
   */
  CSC_REQUEST_FAILED = 'CSC_REQUEST_FAILED',
}

export const genericErrorCodeToTrpcErrorCodeMap: Record<string, { code: string; status: number }> = {
  [AppErrorCode.ALREADY_EXISTS]: { code: 'BAD_REQUEST', status: 400 },
  [AppErrorCode.RECIPIENT_EXPIRED]: { code: 'BAD_REQUEST', status: 400 },
  [AppErrorCode.EXPIRED_CODE]: { code: 'BAD_REQUEST', status: 400 },
  [AppErrorCode.INVALID_BODY]: { code: 'BAD_REQUEST', status: 400 },
  [AppErrorCode.INVALID_REQUEST]: { code: 'BAD_REQUEST', status: 400 },
  [AppErrorCode.INVALID_CAPTCHA]: { code: 'BAD_REQUEST', status: 400 },
  [AppErrorCode.NOT_FOUND]: { code: 'NOT_FOUND', status: 404 },
  [AppErrorCode.NOT_IMPLEMENTED]: { code: 'INTERNAL_SERVER_ERROR', status: 501 },
  [AppErrorCode.NOT_SETUP]: { code: 'BAD_REQUEST', status: 400 },
  [AppErrorCode.MISSING_ENV_VAR]: { code: 'INTERNAL_SERVER_ERROR', status: 500 },
  [AppErrorCode.UNAUTHORIZED]: { code: 'UNAUTHORIZED', status: 401 },
  [AppErrorCode.FORBIDDEN]: { code: 'FORBIDDEN', status: 403 },
  [AppErrorCode.UNKNOWN_ERROR]: { code: 'INTERNAL_SERVER_ERROR', status: 500 },
  [AppErrorCode.RETRY_EXCEPTION]: { code: 'INTERNAL_SERVER_ERROR', status: 500 },
  [AppErrorCode.SCHEMA_FAILED]: { code: 'INTERNAL_SERVER_ERROR', status: 500 },
  [AppErrorCode.TOO_MANY_REQUESTS]: { code: 'TOO_MANY_REQUESTS', status: 429 },
  [AppErrorCode.TWO_FACTOR_AUTH_FAILED]: { code: 'UNAUTHORIZED', status: 401 },
  [AppErrorCode.ENVELOPE_DRAFT]: { code: 'BAD_REQUEST', status: 400 },
  [AppErrorCode.ENVELOPE_COMPLETED]: { code: 'BAD_REQUEST', status: 400 },
  [AppErrorCode.ENVELOPE_REJECTED]: { code: 'BAD_REQUEST', status: 400 },
  [AppErrorCode.ENVELOPE_CANCELLED]: { code: 'BAD_REQUEST', status: 400 },
  [AppErrorCode.ENVELOPE_LEGACY]: { code: 'BAD_REQUEST', status: 400 },
  [AppErrorCode.ENVELOPE_TSP_LOCKED]: { code: 'BAD_REQUEST', status: 400 },
  [AppErrorCode.CSC_INSTANCE_MODE_MISMATCH]: { code: 'BAD_REQUEST', status: 400 },
  [AppErrorCode.CSC_UNLICENSED]: { code: 'FORBIDDEN', status: 403 },
  [AppErrorCode.CSC_PROVIDER_INFO_FAILED]: { code: 'INTERNAL_SERVER_ERROR', status: 500 },
  [AppErrorCode.CSC_PROVIDER_NO_TSA]: { code: 'INTERNAL_SERVER_ERROR', status: 500 },
  [AppErrorCode.CSC_CREDENTIAL_LIST_EMPTY]: { code: 'BAD_REQUEST', status: 400 },
  [AppErrorCode.CSC_CERT_INVALID]: { code: 'BAD_REQUEST', status: 400 },
  [AppErrorCode.CSC_ALGORITHM_REFUSED]: { code: 'BAD_REQUEST', status: 400 },
  [AppErrorCode.CSC_SAD_EXPIRED_PRE_SIGN]: { code: 'BAD_REQUEST', status: 400 },
  [AppErrorCode.CSC_TSP_TIMEOUT]: { code: 'TIMEOUT', status: 408 },
  [AppErrorCode.CSC_EMBED_FAILED]: { code: 'BAD_REQUEST', status: 400 },
  [AppErrorCode.CSC_BASE_DOCUMENT_MUTATED]: { code: 'INTERNAL_SERVER_ERROR', status: 500 },
  // Generic transport failure — the TSP is upstream so server-side from our
  // perspective; 500 keeps the caller surface conservative. The TSP's actual
  // HTTP status rides along in AppError.statusCode for the few callers that
  // need to discriminate (e.g. 401 → re-auth, 429 → backoff).
  [AppErrorCode.CSC_REQUEST_FAILED]: { code: 'INTERNAL_SERVER_ERROR', status: 500 },
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

  /**
   * Optional headers to include when this error is returned in an API response.
   */
  headers?: Record<string, string>;
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

  headers?: Record<string, string>;

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
    this.headers = options?.headers;
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
    const validUserMessage: string | undefined = typeof userMessage === 'string' ? userMessage : undefined;

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
    status: 400 | 401 | 403 | 404 | 500 | 501;
    body: { message: string };
  } {
    const error = AppError.parseError(err);

    const status = match(error.code)
      .with(
        AppErrorCode.INVALID_BODY,
        AppErrorCode.INVALID_REQUEST,
        AppErrorCode.ENVELOPE_DRAFT,
        AppErrorCode.ENVELOPE_COMPLETED,
        AppErrorCode.ENVELOPE_REJECTED,
        AppErrorCode.ENVELOPE_CANCELLED,
        AppErrorCode.ENVELOPE_LEGACY,
        AppErrorCode.ENVELOPE_TSP_LOCKED,
        AppErrorCode.CSC_INSTANCE_MODE_MISMATCH,
        AppErrorCode.CSC_CREDENTIAL_LIST_EMPTY,
        AppErrorCode.CSC_CERT_INVALID,
        AppErrorCode.CSC_ALGORITHM_REFUSED,
        AppErrorCode.CSC_SAD_EXPIRED_PRE_SIGN,
        AppErrorCode.CSC_EMBED_FAILED,
        () => 400 as const,
      )
      .with(AppErrorCode.UNAUTHORIZED, () => 401 as const)
      .with(AppErrorCode.FORBIDDEN, AppErrorCode.CSC_UNLICENSED, () => 403 as const)
      .with(AppErrorCode.NOT_FOUND, () => 404 as const)
      .with(AppErrorCode.NOT_IMPLEMENTED, () => 501 as const)
      .otherwise(() => 500 as const);

    return {
      status,
      body: {
        message: status !== 500 ? error.message : 'Something went wrong',
      },
    };
  }
}
