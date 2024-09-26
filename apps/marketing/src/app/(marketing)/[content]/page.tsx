import Image from 'next/image';
import { notFound } from 'next/navigation';

import { allDocuments } from 'contentlayer/generated';
import type { MDXComponents } from 'mdx/types';
import { useMDXComponent } from 'next-contentlayer/hooks';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';

export const dynamic = 'force-dynamic';

export const generateMetadata = ({ params }: { params: { content: string } }) => {
  const document = allDocuments.find((doc) => doc._raw.flattenedPath === params.content);

  if (!document) {
    return { title: 'Not Found' };
  }

  return { title: document.title };
};

const mdxComponents: MDXComponents = {
  MdxNextImage: (props: { width: number; height: number; alt?: string; src: string }) => (
    <Image {...props} alt={props.alt ?? ''} />
  ),
};

/**
 * A generic catch all page for the root level that checks for content layer documents.
 *
 * Will render the document if it exists, otherwise will return a 404.
 */
export default function ContentPage({ params }: { params: { content: string } }) {
  setupI18nSSR();

  const post = allDocuments.find((post) => post._raw.flattenedPath === params.content);

  if (!post) {
    notFound();
  }

  const MDXContent = useMDXComponent(post.body.code);

  return (
    <article className="prose dark:prose-invert mx-auto">
      <MDXContent components={mdxComponents} />
    </article>
  );
}
