import { Trans } from '@lingui/react/macro';
import { Loader } from 'lucide-react';

export const EmbedClientLoading = () => {
  return (
    <div className="bg-background fixed left-0 top-0 z-[9999] flex h-full w-full items-center justify-center">
      <Loader className="mr-2 h-4 w-4 animate-spin" />

      <span>
        <Trans>Loading...</Trans>
      </span>
    </div>
  );
};
