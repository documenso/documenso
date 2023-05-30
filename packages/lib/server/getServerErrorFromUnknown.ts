import { HttpError } from "@documenso/lib/server";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

export function getServerErrorFromUnknown(cause: unknown): HttpError {
  // Error was manually thrown and does not need to be parsed.
  if (cause instanceof HttpError) {
    return cause;
  }

  if (cause instanceof SyntaxError) {
    return new HttpError({
      statusCode: 500,
      message: "Unexpected error, please reach out for our customer support.",
    });
  }

  if (cause instanceof PrismaClientKnownRequestError) {
    return new HttpError({ statusCode: 400, message: cause.message, cause });
  }

  if (cause instanceof PrismaClientKnownRequestError) {
    return new HttpError({ statusCode: 404, message: cause.message, cause });
  }

  if (cause instanceof Error) {
    return new HttpError({ statusCode: 500, message: cause.message, cause });
  }

  if (typeof cause === "string") {
    // @ts-expect-error https://github.com/tc39/proposal-error-cause
    return new Error(cause, { cause });
  }

  // Catch-All if none of the above triggered and something (even more) unexpected happend
  return new HttpError({
    statusCode: 500,
    message: `Unhandled error of type '${typeof cause}'. Please reach out for our customer support.`,
  });
}
