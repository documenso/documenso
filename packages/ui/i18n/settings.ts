import type { InitOptions } from 'i18next';

export const fallbackLng = 'fr';
export const locales = [fallbackLng, 'fr', 'sv'] as const;
export type LocaleTypes = (typeof locales)[number];
export const defaultNS = 'marketing';

export function getOptions(lang = fallbackLng, ns = defaultNS): InitOptions {
  return {
    // debug: true, // Set to true to see console logs
    supportedLngs: locales,
    fallbackLng,
    lng: lang,
    fallbackNS: defaultNS,
    defaultNS,
    ns,
  };
}
