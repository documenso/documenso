import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';

export const appMetaTags = (title?: string) => {
  const description =
    'RJUSL Signing is a secure document signing platform by RJ Utility Services Ltd. Sign documents online with ease.';

  return [
    {
      title: title ? `${title} - RJUSL Signing` : 'RJUSL Signing',
    },
    {
      name: 'description',
      content: description,
    },
    {
      name: 'keywords',
      content:
        'RJUSL Signing, document signing, RJ Utility Services, electronic signatures, online document signing',
    },
    {
      name: 'author',
      content: 'RJ Utility Services Ltd',
    },
    {
      name: 'robots',
      content: 'index, follow',
    },
    {
      property: 'og:title',
      content: 'RJUSL Signing - Document Signing Platform',
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
      name: 'twitter:description',
      content: description,
    },
    {
      name: 'twitter:image',
      content: `${NEXT_PUBLIC_WEBAPP_URL()}/opengraph-image.jpg`,
    },
  ];
};
