import type { SVGAttributes } from 'react';

export type LogoProps = SVGAttributes<SVGSVGElement>;

export const Logo = ({ ...props }: LogoProps) => {
  return <p className="text-4xl font-bold text-white">Maddocs</p>;
};
