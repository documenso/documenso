import type { DataTransformer } from '@trpc/server';
import SuperJSON from 'superjson';

export const dataTransformer: DataTransformer = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serialize: (data: any) => {
    if (data instanceof FormData) {
      return data;
    }

    return SuperJSON.serialize(data);
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deserialize: (data: any) => {
    return SuperJSON.deserialize(data);
  },
};
