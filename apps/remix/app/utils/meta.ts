import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';

export const appMetaTags = (title?: string) => {
  const description =
    'JustX - Plataforma moderna de assinatura de documentos. Assine documentos digitalmente de forma rápida, segura e eficiente. Tecnologia de ponta para sua empresa.';

  return [
    {
      title: title ? `${title} - JustX` : 'JustX',
    },
    {
      name: 'description',
      content: description,
    },
    {
      name: 'keywords',
      content:
        'JustX, assinatura digital, documentos, tecnologia, startup, assinatura eletrônica, plataforma de assinatura',
    },
    {
      name: 'author',
      content: 'JustX',
    },
    {
      name: 'robots',
      content: 'index, follow',
    },
    {
      property: 'og:title',
      content: 'JustX - Plataforma de Assinatura Digital',
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
      content: '@justx',
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
