import { trpc } from '@documenso/trpc/react';
import { TCreateOrGetShareLinkMutationSchema } from '@documenso/trpc/server/share-link-router/schema';

import { useCopyToClipboard } from './use-copy-to-clipboard';

export type UseCopyShareLinkOptions = {
  onSuccess?: () => void;
  onError?: () => void;
};

export function useCopyShareLink({ onSuccess, onError }: UseCopyShareLinkOptions) {
  const [, copyToClipboard] = useCopyToClipboard();

  const { mutateAsync: createOrGetShareLink, isLoading: isCreatingShareLink } =
    trpc.shareLink.createOrGetShareLink.useMutation();

  /**
   * Copy a newly created, or pre-existing share link to the user's clipboard.
   *
   * @param payload The payload to create or get a share link.
   */
  const createAndCopyShareLink = async (payload: TCreateOrGetShareLinkMutationSchema) => {
    const valueToCopy = createOrGetShareLink(payload).then(
      (result) => `${window.location.origin}/share/${result.slug}`,
    );

    await copyShareLink(valueToCopy);
  };

  /**
   * Copy a share link to the user's clipboard.
   *
   * @param shareLink Either the share link itself or a promise that returns a shared link.
   */
  const copyShareLink = async (shareLink: Promise<string> | string) => {
    try {
      const isCopySuccess = await copyToClipboard(shareLink);
      if (!isCopySuccess) {
        throw new Error('Copy to clipboard failed');
      }

      onSuccess?.();
    } catch (e) {
      onError?.();
    }
  };

  return {
    createAndCopyShareLink,
    copyShareLink,
    isCopyingShareLink: isCreatingShareLink,
  };
}
