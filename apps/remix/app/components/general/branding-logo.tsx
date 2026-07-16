import LogoDark from '@documenso/assets/branding/logo-dark.svg';
import LogoLight from '@documenso/assets/branding/logo-light.svg';
import { cn } from '@documenso/ui/lib/utils';
import type { HTMLAttributes } from 'react';

export type LogoProps = HTMLAttributes<HTMLImageElement>;

export const BrandingLogo = ({ className, ...props }: LogoProps) => {
  return (
    <>
      <img src={LogoLight} alt="Keep Contracts" className={cn(className, 'dark:hidden')} {...props} />
      <img src={LogoDark} alt="Keep Contracts" className={cn(className, 'hidden dark:block')} {...props} />
    </>
  );
};
