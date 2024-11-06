import { notFound } from 'next/navigation';

import { allDocuments } from 'contentlayer/generated';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';

import { ContentPageContent } from './content';

export const dynamic = 'force-dynamic';

export const generateMetadata = ({ params }: { params: { content: string } }) => {
  const document = allDocuments.find((doc) => doc._raw.flattenedPath === params.content);

  if (!document) {
    return { title: 'Not Found' };
  }

  return { title: document.title };
};

/**
 * A generic catch all page for the root level that checks for content layer documents.
 *
 * Will render the document if it exists, otherwise will return a 404.
 */
export default async function ContentPage({ params }: { params: { content: string } }) {
  await setupI18nSSR();

  const post = allDocuments.find((post) => post._raw.flattenedPath === params.content);

  if (!post) {
    notFound();
  }

  return (
    <article className="prose dark:prose-invert mx-auto">
      <ContentPageContent document={post} />
    </article>
  );
}
