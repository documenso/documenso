'use client';

import Image from 'next/image';

import type { BlogPost } from 'contentlayer/generated';
import type { MDXComponents } from 'mdx/types';
import { useMDXComponent } from 'next-contentlayer/hooks';

const mdxComponents: MDXComponents = {
  MdxNextImage: (props: { width: number; height: number; alt?: string; src: string }) => (
    <Image {...props} alt={props.alt ?? ''} />
  ),
};

export type BlogPostContentProps = {
  post: BlogPost;
};

export const BlogPostContent = ({ post }: BlogPostContentProps) => {
  const MdxContent = useMDXComponent(post.body.code);

  return <MdxContent components={mdxComponents} />;
};
