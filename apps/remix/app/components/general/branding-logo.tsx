import type { SVGAttributes } from "react";

export type LogoProps = SVGAttributes<SVGSVGElement>;

export const BrandingLogo = ({ ...props }: LogoProps) => {
  return (
    <div className="flex items-center mt-8">
      <img
        src="https://gcmasesores.io/images/logo-gcm-white.png"
        alt="GCM Asesores"
        width={140}
        height={28}
      />
    </div>
  );
};
