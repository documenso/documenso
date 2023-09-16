export function makeSerializable<T extends any>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}
