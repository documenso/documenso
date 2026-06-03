import type { HTMLAttributes } from 'react';

export type LogoProps = HTMLAttributes<HTMLImageElement> & {
  className?: string;
};

export const BrandingLogoIcon = ({ className, ...props }: LogoProps) => {
  return (
    <img
      src="/static/psd-logo-light.png"
      alt="PSD Document Signing"
      className={className}
      {...props}
    />
  );
};
