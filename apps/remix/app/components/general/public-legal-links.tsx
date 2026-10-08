import {
  NEXT_PUBLIC_IMPRINT_URL,
  NEXT_PUBLIC_PRIVACY_POLICY_URL,
  NEXT_PUBLIC_TERMS_OF_SERVICE_URL,
} from '@documenso/lib/constants/app';
import { cn } from '@documenso/ui/lib/utils';
import { DropdownMenuItem, DropdownMenuSeparator } from '@documenso/ui/primitives/dropdown-menu';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Link } from 'react-router';

export type PublicLegalLinksProps = {
  className?: string;
};

export const PublicLegalLinks = ({ className }: PublicLegalLinksProps) => {
  const { _ } = useLingui();

  const links = getPublicLegalLinks();

  if (links.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-muted-foreground text-xs',
        className,
      )}
    >
      {links.map((link) => (
        <Link
          key={link.href}
          to={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="duration-200 hover:text-foreground hover:underline"
        >
          {_(link.label)}
        </Link>
      ))}
    </div>
  );
};

export const PublicLegalLinksDropdownMenuItems = () => {
  const { _ } = useLingui();

  const links = getPublicLegalLinks();

  if (links.length === 0) {
    return null;
  }

  return (
    <>
      <DropdownMenuSeparator />

      {links.map((link) => (
        <DropdownMenuItem key={link.href} asChild className="text-muted-foreground text-xs">
          <Link to={link.href} target="_blank" rel="noopener noreferrer">
            {_(link.label)}
          </Link>
        </DropdownMenuItem>
      ))}
    </>
  );
};

const getPublicLegalLinks = () => {
  const termsUrl = NEXT_PUBLIC_TERMS_OF_SERVICE_URL();
  const privacyUrl = NEXT_PUBLIC_PRIVACY_POLICY_URL();
  const imprintUrl = NEXT_PUBLIC_IMPRINT_URL();

  const links = [
    termsUrl ? { label: msg`Terms of Service`, href: termsUrl } : null,
    privacyUrl ? { label: msg`Privacy Policy`, href: privacyUrl } : null,
    imprintUrl ? { label: msg`Imprint`, href: imprintUrl } : null,
  ];

  return links.filter((link) => link !== null);
};
