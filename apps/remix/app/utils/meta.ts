import { i18n, type MessageDescriptor } from '@lingui/core';

export const appMetaTags = (title?: MessageDescriptor) => {
  const description = 'Keep Contracts — simple, secure document signing for your team.';

  return [
    {
      title: title ? `${i18n._(title)} - Keep Contracts` : 'Keep Contracts',
    },
    {
      name: 'description',
      content: description,
    },
    {
      name: 'keywords',
      content: 'Keep Contracts, document signing, secure contracts, DataThink',
    },
    {
      name: 'author',
      content: 'DataThink',
    },
    {
      name: 'robots',
      content: 'index, follow',
    },
    {
      property: 'og:title',
      content: 'Keep Contracts',
    },
    {
      property: 'og:description',
      content: description,
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
      content: '@datathink',
    },
    {
      name: 'twitter:description',
      content: description,
    },
  ];
};
