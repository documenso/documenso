import type { SVGAttributes } from "react";

export type LogoProps = SVGAttributes<SVGSVGElement>;

export const BrandingLogo = ({ ...props }: LogoProps) => {
  return (
    <div className="flex items-center">
      <img
        src="https://gcmasesores.io/images/logo-gcm-white.png"
        alt="GCM Asesores"
        width={120}
        height={25}
      />
    </div>
  );
};
