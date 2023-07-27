import Image from 'next/image';
import { notFound } from 'next/navigation';

import { allBlogPosts } from 'contentlayer/generated';
import type { MDXComponents } from 'mdx/types';
import { useMDXComponent } from 'next-contentlayer/hooks';

export const generateStaticParams = async () =>
  allBlogPosts.map((post) => ({ post: post._raw.flattenedPath }));

export const generateMetadata = ({ params }: { params: { post: string } }) => {
  const blogPost = allBlogPosts.find((post) => post._raw.flattenedPath === `blog/${params.post}`);

  if (!blogPost) {
    notFound();
  }

  return { title: `Documenso - ${blogPost.title}` };
};

const mdxComponents: MDXComponents = {
  MdxNextImage: (props: { width: number; height: number; alt?: string; src: string }) => (
    <Image {...props} alt={props.alt ?? ''} />
  ),
};

export default function BlogPostPage({ params }: { params: { post: string } }) {
  const post = allBlogPosts.find((post) => post._raw.flattenedPath === `blog/${params.post}`);

  if (!post) {
    notFound();
  }

  const MDXContent = useMDXComponent(post.body.code);

  return (
    <article className="prose prose-slate mx-auto py-8">
      <div className="mb-6 text-center">
        <time dateTime={post.date} className="mb-1 text-xs text-gray-600">
          {new Date(post.date).toLocaleDateString()}
        </time>

        <h1 className="text-3xl font-bold">{post.title}</h1>

        <div className="not-prose relative -mt-2 flex items-center gap-x-4 border-b border-t py-4">
          <div className="h-10 w-10 rounded-full bg-gray-50">
            {post.authorImage && (
              <img
                src={post.authorImage}
                alt={`Image of ${post.authorName}`}
                className="h-10 w-10 rounded-full bg-gray-50"
              />
            )}
          </div>

          <div className="text-sm leading-6">
            <p className="text-left font-semibold text-gray-900">{post.authorName}</p>
            <p className="text-gray-600">{post.authorRole}</p>
          </div>
        </div>
      </div>

      <MDXContent components={mdxComponents} />

      {post.tags.length > 0 && (
        <ul className="not-prose flex list-none flex-row space-x-2 px-0">
          {post.tags.map((tag, i) => (
            <li
              key={`tag-${i}`}
              className="relative z-10 whitespace-nowrap rounded-full bg-gray-50 px-3 py-1.5 font-medium text-gray-600 hover:bg-gray-100"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
