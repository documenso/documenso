import type { ImgHTMLAttributes } from 'react';

import justxLogoIcon from '@documenso/assets/logo_icon.png';

export type LogoProps = ImgHTMLAttributes<HTMLImageElement>;

export const BrandingLogoIcon = ({ className, alt = 'JustX Logo', ...props }: LogoProps) => {
  return (
    <img
      src={justxLogoIcon}
      alt={alt}
      className={className}
      {...props}
    />
  );
};
