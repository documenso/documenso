import { NextResponse } from 'next/server';

import { ZodError, infer as ZodInfer, ZodType } from 'zod';
import { fromZodError } from 'zod-validation-error';

import { prisma } from '@documenso/prisma';

type Config<Context> = {
  createContext(): Context;
};

type QueryFn<Context, Result, T, U> = (_data: {
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

type APIResponse<T> = TSuccessAPIResponse<T> | TErroredAPIResponse;

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
          async query<Result>(queryFn: QueryFn<Context, Result, ZodType<T>, ZodType<V>>) {
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
                );
              }
            }

            return await queryFn({
              req,
              context,
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
