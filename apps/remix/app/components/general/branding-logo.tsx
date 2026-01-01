import type { ImgHTMLAttributes } from 'react';

import justxLogo from '@documenso/assets/logo.png';

export type LogoProps = ImgHTMLAttributes<HTMLImageElement>;

export const BrandingLogo = ({ className, alt = 'JustX Logo', ...props }: LogoProps) => {
  return (
    <img
      src={justxLogo}
      alt={alt}
      className={className}
      {...props}
    />
  );
};
