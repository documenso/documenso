/**
 * Below type is borrowed from Trigger.dev's SDK, it may be moved elsewhere later.
 */

export type JsonPrimitive = string | number | boolean | null | undefined | Date | symbol;

export type JsonArray = Json[];

export type JsonRecord<T> = {
  [Property in keyof T]: Json;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json<T = any> = JsonPrimitive | JsonArray | JsonRecord<T>;
