import { customAlphabet } from 'nanoid';

export const alphaid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 21);

export { nanoid } from 'nanoid';

export const generatePrefixedId = (prefix: string, length = 8) => {
  return `${prefix}_${alphaid(length)}`;
};
