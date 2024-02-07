import type { InitOptions, Resource } from 'i18next';
import { createInstance } from 'i18next';
import type { i18n as i18nInstance } from 'i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { initReactI18next } from 'react-i18next/initReactI18next';

import i18nConfig from '../../i18nConfig';

export default async function initTranslations(
  locale: string,
  namespaces = ['common'],
  i18nInstance?: i18nInstance,
  resources?: Resource,
) {
  i18nInstance = i18nInstance || createInstance();

  i18nInstance.use(initReactI18next);

  if (!resources) {
    i18nInstance.use(
      resourcesToBackend(
        async (language: string, namespace: string) =>
          import(`../../../../locales/${language}/${namespace}`),
      ),
    );
  }

  const i18nOptions: InitOptions = {
    lng: locale,
    resources,
    fallbackLng: i18nConfig.defaultLocale,
    supportedLngs: i18nConfig.locales,
    defaultNS: namespaces[0],
    fallbackNS: namespaces[0],
    ns: namespaces,
    preload: resources ? [] : i18nConfig.locales,
  };

  await i18nInstance.init(i18nOptions);

  return {
    i18n: i18nInstance,
    resources: i18nInstance.services.resourceStore.data,
    t: i18nInstance.t,
  };
}
