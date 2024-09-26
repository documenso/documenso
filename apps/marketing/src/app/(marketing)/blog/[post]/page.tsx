import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { allBlogPosts } from 'contentlayer/generated';
import { ChevronLeft } from 'lucide-react';
import type { MDXComponents } from 'mdx/types';
import { useMDXComponent } from 'next-contentlayer/hooks';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';

import { CallToAction } from '~/components/(marketing)/call-to-action';

export const dynamic = 'force-dynamic';

export const generateMetadata = ({ params }: { params: { post: string } }) => {
  const blogPost = allBlogPosts.find((post) => post._raw.flattenedPath === `blog/${params.post}`);

  if (!blogPost) {
    return {
      title: 'Not Found',
    };
  }

  // Use the url constructor to ensure that things are escaped as they should be
  const searchParams = new URLSearchParams({
    title: blogPost.title,
    author: blogPost.authorName,
  });

  return {
    title: {
      absolute: `${blogPost.title} - Documenso Blog`,
    },
    description: blogPost.description,
    openGraph: {
      images: [`${blogPost.href}/opengraph?${searchParams.toString()}`],
    },
    twitter: {
      images: [`${blogPost.href}/opengraph?${searchParams.toString()}`],
    },
  };
};

const mdxComponents: MDXComponents = {
  MdxNextImage: (props: { width: number; height: number; alt?: string; src: string }) => (
    <Image {...props} alt={props.alt ?? ''} />
  ),
};

export default function BlogPostPage({ params }: { params: { post: string } }) {
  setupI18nSSR();

  const post = allBlogPosts.find((post) => post._raw.flattenedPath === `blog/${params.post}`);

  if (!post) {
    notFound();
  }

  const MDXContent = useMDXComponent(post.body.code);

  return (
    <div>
      <article className="prose dark:prose-invert mx-auto py-8">
        <div className="mb-6 text-center">
          <time dateTime={post.date} className="text-muted-foreground mb-1 text-xs">
            {new Date(post.date).toLocaleDateString()}
          </time>

          <h1 className="text-3xl font-bold">{post.title}</h1>

          <div className="not-prose relative -mt-2 flex items-center gap-x-4 border-b border-t py-4">
            <div className="bg-foreground h-10 w-10 rounded-full">
              {post.authorImage && (
                <img
                  src={post.authorImage}
                  alt={`Image of ${post.authorName}`}
                  className="bg-foreground/10 h-10 w-10 rounded-full"
                />
              )}
            </div>

            <div className="text-sm leading-6">
              <p className="text-foreground text-left font-semibold">{post.authorName}</p>
              <p className="text-muted-foreground">{post.authorRole}</p>
            </div>
          </div>
        </div>

        <MDXContent components={mdxComponents} />

        {post.tags.length > 0 && (
          <ul className="not-prose flex list-none flex-row space-x-2 px-0">
            {post.tags.map((tag, i) => (
              <li
                key={`tag-${i}`}
                className="bg-muted hover:bg-muted/60 text-foreground relative z-10 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}

        <hr />

        <Link href="/blog" className="text-muted-foreground flex items-center hover:opacity-60">
          <ChevronLeft className="mr-2 h-6 w-6" />
          Back to all posts
        </Link>
      </article>

      {post.cta && <CallToAction className="mt-8" utmSource={`blog_${params.post}`} />}
    </div>
  );
}
