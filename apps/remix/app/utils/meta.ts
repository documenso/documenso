import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';

export const appMetaTags = (title?: string) => {
  const description =
    'SuiteOp Sign - Professional document signing platform. Fast, secure, and beautiful document signing experience. Integrates with your favorite tools, customizable, and expandable.';

  return [
    {
      title: title ? `${title} - SuiteOp Sign` : 'SuiteOp Sign',
    },
    {
      name: 'description',
      content: description,
    },
    {
      name: 'keywords',
      content:
        'SuiteOp Sign, document signing, electronic signature, digital signing, professional signing, document management, secure signing, fast signing, beautiful signing, smart templates',
    },
    {
      name: 'author',
      content: 'SuiteOp, Inc.',
    },
    {
      name: 'robots',
      content: 'index, follow',
    },
    {
      property: 'og:title',
      content: 'SuiteOp Sign - Professional Document Signing Platform',
    },
    {
      property: 'og:description',
      content: description,
    },
    {
      property: 'og:image',
      content: `${NEXT_PUBLIC_WEBAPP_URL()}/opengraph-image.jpg`,
    },
    {
      property: 'og:type',
      content: 'website',
    },
    {
      name: 'twitter:card',
      content: 'summary_large_image',
    },
    {
      name: 'twitter:site',
      content: '@suiteop',
    },
    {
      name: 'twitter:description',
      content: description,
    },
    {
      name: 'twitter:image',
      content: `${NEXT_PUBLIC_WEBAPP_URL()}/opengraph-image.jpg`,
    },
  ];
};
