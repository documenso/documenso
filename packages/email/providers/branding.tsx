import { createContext, useContext } from 'react';

import { DEFAULT_BRANDING_LOGO_SIZE } from '@documenso/lib/constants/organisations';

type BrandingContextValue = {
  brandingEnabled: boolean;
  brandingUrl: string;
  brandingLogo: string;
  // optional Tailwind height class for branding logo, e.g. 'h-16'
  brandingLogoSize?: string;
  brandingCompanyDetails: string;
  brandingHidePoweredBy: boolean;
};

const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);

const defaultBrandingContextValue: BrandingContextValue = {
  brandingEnabled: false,
  brandingUrl: '',
  brandingLogo: '',
  brandingLogoSize: DEFAULT_BRANDING_LOGO_SIZE,
  brandingCompanyDetails: '',
  brandingHidePoweredBy: false,
};

export const BrandingProvider = (props: {
  branding?: BrandingContextValue;
  children: React.ReactNode;
}) => {
  return (
    <BrandingContext.Provider value={props.branding ?? defaultBrandingContextValue}>
      {props.children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => {
  const ctx = useContext(BrandingContext);

  if (!ctx) {
    throw new Error('Branding context not found');
  }

  return {
    ...ctx,
    brandingLogoSize: ctx.brandingLogoSize || DEFAULT_BRANDING_LOGO_SIZE,
  };
};

export type BrandingSettings = BrandingContextValue;
