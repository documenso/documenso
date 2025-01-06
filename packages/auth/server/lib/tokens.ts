import { customAlphabet } from 'nanoid';

const sessionTokenId = customAlphabet('abcdefhiklmnorstuvwxz', 10);

export const createSessionToken = (length = 10) => `session_${sessionTokenId(length)}` as const;
