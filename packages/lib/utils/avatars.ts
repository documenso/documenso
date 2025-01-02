import { NEXT_PUBLIC_WEBAPP_URL } from '../constants/app';

export const formatAvatarUrl = (imageId?: string | null) => {
  if (!imageId) {
    return undefined;
  }

  return `${NEXT_PUBLIC_WEBAPP_URL()}/api/avatar/${imageId}`;
};
