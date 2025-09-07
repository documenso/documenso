import type { SVGAttributes } from 'react';
import Image from "next/image";

export type LogoProps = SVGAttributes<SVGSVGElement>;

export const BrandingLogo = ({ ...props }: LogoProps) => {
  return (
    <div className="flex items-center">
      <Image src="https://gcmasesores.io/images/logo-gcm-white.png" alt="GCM Asesores" width={140} height={28} priority />
    </div>
  );
};
