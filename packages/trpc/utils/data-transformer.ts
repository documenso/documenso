import type { DataTransformer } from '@trpc/server';
import SuperJSON from 'superjson';

export const dataTransformer: DataTransformer = {
  serialize: (data: unknown) => {
    if (data instanceof FormData) {
      return data;
    }

    return SuperJSON.serialize(data);
  },
  deserialize: (data: unknown) => {
    return SuperJSON.deserialize(data);
  },
};
