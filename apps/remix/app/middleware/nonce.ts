import type { MiddlewareFunction } from 'react-router';

import { getRequestNonce } from '../../server/load-context';
import { nonceContext } from '../utils/nonce';

export const nonceMiddleware: MiddlewareFunction = ({ context }) => {
  context.set(nonceContext, getRequestNonce());
};
