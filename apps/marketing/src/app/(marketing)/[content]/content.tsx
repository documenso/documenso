'use client';

import Image from 'next/image';

import type { DocumentTypes } from 'contentlayer/generated';
import type { MDXComponents } from 'mdx/types';
import { useMDXComponent } from 'next-contentlayer/hooks';

const mdxComponents: MDXComponents = {
  MdxNextImage: (props: { width: number; height: number; alt?: string; src: string }) => (
    <Image {...props} alt={props.alt ?? ''} />
  ),
};

export type ContentPageContentProps = {
  document: DocumentTypes;
};

export const ContentPageContent = ({ document }: ContentPageContentProps) => {
  const MDXContent = useMDXComponent(document.body.code);

  return <MDXContent components={mdxComponents} />;
};
