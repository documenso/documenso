import type { BrandingLogoSize } from '@documenso/lib/constants/organisations';

import { DEFAULT_BRANDING_LOGO_SIZE } from '@documenso/lib/constants/organisations';
import { createContext, useContext } from 'react';

type BrandingContextValue = {
  brandingEnabled: boolean;
  brandingUrl: string;
  brandingLogo: string;
  brandingLogoSize?: BrandingLogoSize;
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

export const BrandingProvider = (props: { branding?: BrandingContextValue; children: React.ReactNode }) => {
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
