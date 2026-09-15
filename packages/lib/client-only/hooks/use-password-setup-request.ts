import { authClient } from '@documenso/auth/client';
import { useMutation } from '@tanstack/react-query';

import { AppError } from '../../errors/app-error';
import { useSession } from '../providers/session';

export type UsePasswordSetupRequestOptions = {
  onSuccess?: () => void;
  onError?: (errorCode: string) => void;
};

/**
 * Sends the signed in user the standard password reset email so they can set a
 * password via a verified link, rather than letting a bare session mint one.
 */
export const usePasswordSetupRequest = ({ onSuccess, onError }: UsePasswordSetupRequestOptions = {}) => {
  const { user } = useSession();

  const { mutate, isPending, isSuccess, error } = useMutation({
    mutationFn: async () => authClient.emailPassword.forgotPassword({ email: user.email }),
    onSuccess,
    onError: (err) => onError?.(AppError.parseError(err).code),
  });

  return {
    requestSetupLink: () => mutate(),
    isPending,
    isSuccess,
    errorCode: error ? AppError.parseError(error).code : null,
  };
};
