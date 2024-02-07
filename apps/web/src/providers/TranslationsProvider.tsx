'use client';

import type { Resource } from 'i18next';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';

import initTranslations from '~/app/i18n';

interface TranslationsProviderProps {
  locale: string;
  namespaces?: string[];
  children: React.ReactNode;
  resources: Resource;
}

export default function TranslationsProvider({
  locale,
  namespaces = ['common'],
  children,
  resources,
}: TranslationsProviderProps) {
  const i18n = createInstance();

  void initTranslations(locale, namespaces, i18n, resources);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
