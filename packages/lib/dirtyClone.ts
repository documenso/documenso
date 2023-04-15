export const dirtyClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
}