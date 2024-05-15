/**
 * Below type is borrowed from Trigger.dev's SDK, it may be moved elsewhere later.
 */

type JsonPrimitive = string | number | boolean | null | undefined | Date | symbol;

type JsonArray = Json[];

type JsonRecord<T> = {
  [Property in keyof T]: Json;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json<T = any> = JsonPrimitive | JsonArray | JsonRecord<T>;
