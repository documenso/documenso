/* eslint-disable @typescript-eslint/consistent-type-assertions */

/* eslint-disable @typescript-eslint/no-unnecessary-type-constraint */

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * https://github.com/kiliman/remix-superjson/
 */
import { useActionData, useLoaderData } from 'react-router';
import * as _superjson from 'superjson';

export type SuperJsonFunction = <Data extends unknown>(
  data: Data,
  init?: number | ResponseInit,
) => SuperTypedResponse<Data>;

export declare type SuperTypedResponse<T extends unknown = unknown> = Response & {
  superjson(): Promise<T>;
};

type AppData = any;
type DataFunction = (...args: any[]) => unknown; // matches any function
type DataOrFunction = AppData | DataFunction;

export type UseDataFunctionReturn<T extends DataOrFunction> = T extends (
  ...args: any[]
) => infer Output
  ? Awaited<Output> extends SuperTypedResponse<infer U>
    ? U
    : Awaited<ReturnType<T>>
  : Awaited<T>;

export const superLoaderJson: SuperJsonFunction = (data, init = {}) => {
  const responseInit = typeof init === 'number' ? { status: init } : init;
  const headers = new Headers(responseInit.headers);

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json; charset=utf-8');
  }

  return new Response(_superjson.stringify(data), {
    ...responseInit,
    headers,
  }) as SuperTypedResponse<typeof data>;
};

export function useSuperLoaderData<T = AppData>(): UseDataFunctionReturn<T> {
  const data = useLoaderData();

  return _superjson.deserialize(data);
}
export function useSuperActionData<T = AppData>(): UseDataFunctionReturn<T> | null {
  const data = useActionData();

  return data ? _superjson.deserialize(data) : null;
}
