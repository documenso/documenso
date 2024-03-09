import type { Metadata } from 'next';

import { allBlogPosts } from 'contentlayer/generated';

export const metadata: Metadata = {
  title: 'Blog',
};

export default function BlogPage() {
  const blogPosts = allBlogPosts.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);

    return dateB.getTime() - dateA.getTime();
  });

  return (
    <div className="mt-6 sm:mt-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold lg:text-5xl">From the blog</h1>

        <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-center text-lg leading-normal">
          Get the latest news from Documenso, including product updates, team announcements and
          more!
        </p>
      </div>

      <div className="divide-muted-foreground/20 border-muted-foreground/20 mt-10 divide-y border-t">
        {blogPosts.map((post, i) => (
          <article
            key={`blog-${i}`}
            className="mx-auto mt-8 flex max-w-xl flex-col items-start justify-between pt-8 first:pt-0 sm:mt-16 sm:pt-16"
          >
            <div className="flex items-center gap-x-4 text-xs">
              <time dateTime={post.date} className="text-muted-foreground">
                {new Date(post.date).toLocaleDateString()}
              </time>

              {post.tags.length > 0 && (
                <ul className="flex flex-row space-x-2">
                  {post.tags.map((tag, j) => (
                    <li
                      key={`blog-${i}-tag-${j}`}
                      className="text-foreground bg-muted hover:bg-muted/60 relative z-10 whitespace-nowrap rounded-full px-3 py-1.5 font-medium"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="group relative">
              <h3 className="text-foreground group-hover:text-foreground/60 mt-3 text-lg font-semibold leading-6">
                <a href={post.href}>
                  <span className="absolute inset-0" />
                  {post.title}
                </a>
              </h3>
              <p className="text-foreground/60 mt-5 line-clamp-3 text-sm leading-6">
                {post.description}
              </p>
            </div>

            <div className="relative mt-4 flex items-center gap-x-4">
              <div className="bg-foreground/5 h-10 w-10 rounded-full">
                {post.authorImage && (
                  <img
                    src={post.authorImage}
                    alt={`Image of ${post.authorName}`}
                    className="bg-foreground/5 h-10 w-10 rounded-full"
                  />
                )}
              </div>

              <div className="text-sm leading-6">
                <p className="text-foreground font-semibold">{post.authorName}</p>
                <p className="text-foreground/60">{post.authorRole}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
