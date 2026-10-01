import {
  NEXT_PUBLIC_IMPRINT_URL,
  NEXT_PUBLIC_PRIVACY_POLICY_URL,
  NEXT_PUBLIC_TERMS_OF_SERVICE_URL,
} from '@documenso/lib/constants/app';
import { cn } from '@documenso/ui/lib/utils';
import { Trans } from '@lingui/react/macro';
import { Link } from 'react-router';

export type PublicLegalLinksProps = {
  className?: string;
};

export const PublicLegalLinks = ({ className }: PublicLegalLinksProps) => {
  const termsUrl = NEXT_PUBLIC_TERMS_OF_SERVICE_URL();
  const privacyUrl = NEXT_PUBLIC_PRIVACY_POLICY_URL();
  const imprintUrl = NEXT_PUBLIC_IMPRINT_URL();

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground',
        className,
      )}
    >
      {termsUrl && (
        <Link
          to={termsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="duration-200 hover:text-foreground hover:underline"
        >
          <Trans>Terms of Service</Trans>
        </Link>
      )}

      {privacyUrl && (
        <Link
          to={privacyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="duration-200 hover:text-foreground hover:underline"
        >
          <Trans>Privacy Policy</Trans>
        </Link>
      )}

      {imprintUrl && (
        <Link
          to={imprintUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="duration-200 hover:text-foreground hover:underline"
        >
          <Trans>Imprint</Trans>
        </Link>
      )}
    </div>
  );
};
