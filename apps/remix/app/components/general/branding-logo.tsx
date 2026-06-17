import LogoImage from '@documenso/assets/logo.png';
import type { HTMLAttributes } from 'react';

export type LogoProps = HTMLAttributes<HTMLImageElement>;

export const BrandingLogo = ({ className, ...props }: LogoProps) => {
  return <img src={LogoImage} alt="Keep Contracts" className={className} {...props} />;
};
