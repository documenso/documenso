import IconDark from '@documenso/assets/branding/icon-dark.svg';
import IconLight from '@documenso/assets/branding/icon-light.svg';
import { cn } from '@documenso/ui/lib/utils';
import type { HTMLAttributes } from 'react';

export type LogoProps = HTMLAttributes<HTMLImageElement>;

export const BrandingLogoIcon = ({ className, ...props }: LogoProps) => {
  return (
    <>
      <img src={IconLight} alt="Keep Contracts" className={cn(className, 'dark:hidden')} {...props} />
      <img src={IconDark} alt="Keep Contracts" className={cn(className, 'hidden dark:block')} {...props} />
    </>
  );
};
