import { NextResponse } from 'next/server';

import { ZodError, infer as ZodInfer, ZodType } from 'zod';
import { fromZodError } from 'zod-validation-error';

import { prisma } from '@documenso/prisma';

type Config<Context> = {
  createContext(): Context;
};

type ProcedureFn<Context, Result, T, U> = (_data: {
  req: Request;
  res: typeof NextResponse;
  context: Context;
  input: { query: InferSchema<T>; body: InferSchema<U> };
}) => Result;

interface TErroredAPIResponse {
  success: false;
  data: null;
  message: string;
}

interface TSuccessAPIResponse<T> {
  success: true;
  data: T;
  message: null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InferApiRoute<U extends (..._args: any) => any> = Awaited<
  ReturnType<U>
> extends NextResponse<infer T>
  ? T
  : never;

type APIResponse<T> = TSuccessAPIResponse<NonNullable<T>> | TErroredAPIResponse;

export const returnResponse = <T>(data: APIResponse<T>) => data;

function urlSearchParamsToObject(params: URLSearchParams) {
  const result: Record<string, string> = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
}

type InferSchema<Z> = Z extends ZodType ? ZodInfer<Z> : never;

const builder = <Context>(context: Context) => ({
  create(req: Request) {
    return {
      input<T, V>(schema: { query?: ZodType<T>; body?: ZodType<V> } | undefined) {
        return {
          async procedure<Result>(
            procedureFn: ProcedureFn<Context, Result, ZodType<T>, ZodType<V>>,
          ) {
            const { searchParams } = new URL(req.url);
            let parsedQuery;
            let parsedBody;

            if (schema?.query) {
              try {
                parsedQuery = schema.query.parse(urlSearchParamsToObject(searchParams));
              } catch (error) {
                const isZodError = error instanceof ZodError;

                return NextResponse.json(
                  returnResponse({
                    message: isZodError ? fromZodError(error).message : 'An unknown error occurred',
                    success: false,
                    data: null,
                  }),
                  {
                    status: 500,
                  },
                );
              }
            }

            if (schema?.body) {
              try {
                const body = await req.json();
                parsedBody = schema.body.parse(body);
              } catch (error) {
                const isZodError = error instanceof ZodError;

                return NextResponse.json(
                  returnResponse({
                    message: isZodError ? fromZodError(error).message : 'An unknown error occurred',
                    success: false,
                    data: null,
                  }),
                  {
                    status: 500,
                  },
                );
              }
            }

            return await procedureFn({
              req,
              context,
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              input: { query: parsedQuery as T, body: parsedBody as V },
              res: NextResponse,
            });
          },
        };
      },
    };
  },
});

function createAPI<Context>(config: Config<Context>) {
  const context = config.createContext();
  return builder(context);
}

export const api = createAPI({
  createContext: () => {
    return { db: prisma };
  },
});
