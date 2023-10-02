import { trpc } from '@documenso/trpc/react';
import { TCreateOrGetShareLinkMutationSchema } from '@documenso/trpc/server/share-link-router/schema';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useCopyToClipboard } from './use-copy-to-clipboard';

export function useCopyShareLink() {
  const { toast } = useToast();

  const [, copyToClipboard] = useCopyToClipboard();

  const { mutateAsync: createOrGetShareLink, isLoading: isCreatingShareLink } =
    trpc.shareLink.createOrGetShareLink.useMutation();

  /**
   * Copy a share link to the user's clipboard.
   *
   * Will create or get a share link if one is not provided.
   *
   * @param payload Either the share link itself or the input to create a new share link.
   */
  const copyShareLink = async (payload: TCreateOrGetShareLinkMutationSchema | string) => {
    const valueToCopy =
      typeof payload === 'string'
        ? payload
        : createOrGetShareLink(payload).then(
            (result) => `${window.location.origin}/share/${result.slug}`,
          );

    try {
      const isCopySuccess = await copyToClipboard(valueToCopy);
      if (!isCopySuccess) {
        throw new Error('Copy to clipboard failed');
      }

      toast({
        title: 'Copied to clipboard',
        description: 'The sharing link has been copied to your clipboard.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Something went wrong',
        description: 'The sharing link could not be created at this time. Please try again.',
        duration: 5000,
      });
    }
  };

  return {
    isCopyingShareLink: isCreatingShareLink,
    copyShareLink,
  };
}
