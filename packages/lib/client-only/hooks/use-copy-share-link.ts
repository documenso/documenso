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
    createAndCopyShareLink,
    copyShareLink,
    isCopyingShareLink: isCreatingShareLink,
  };
}
