import { SUPPORT_EMAIL } from '@documenso/lib/constants/app';
import { Trans } from '@lingui/react/macro';
import { Link } from 'react-router';

export const EmbedPaywall = () => {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center text-muted-foreground">
        <p className="font-semibold text-lg">
          <Trans>This feature is not available on your current plan</Trans>
        </p>
        <p className="mt-2 text-sm">
          <Trans>
            Please contact{' '}
            <Link to={`mailto:${SUPPORT_EMAIL}`} target="_blank">
              support
            </Link>{' '}
            if you have any questions.
          </Trans>
        </p>
      </div>
    </div>
  );
};
