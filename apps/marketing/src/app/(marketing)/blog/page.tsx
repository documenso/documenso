import { allBlogPosts } from 'contentlayer/generated';

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

        <p className="mx-auto mt-4 max-w-xl text-center text-lg leading-normal text-[#31373D]">
          Get the latest news from Documenso, including product updates, team announcements and
          more!
        </p>
      </div>

      <div className="mt-10 divide-y divide-gray-100 border-t border-gray-200 ">
        {blogPosts.map((post, i) => (
          <article
            key={`blog-${i}`}
            className="mx-auto mt-8 flex max-w-xl flex-col items-start justify-between pt-8 first:pt-0 sm:mt-16 sm:pt-16"
          >
            <div className="flex items-center gap-x-4 text-xs">
              <time dateTime={post.date} className="text-gray-500">
                {new Date(post.date).toLocaleDateString()}
              </time>

              {post.tags.length > 0 && (
                <ul className="flex flex-row space-x-2">
                  {post.tags.map((tag, j) => (
                    <li
                      key={`blog-${i}-tag-${j}`}
                      className="relative z-10 whitespace-nowrap rounded-full bg-gray-50 px-3 py-1.5 font-medium text-gray-600 hover:bg-gray-100"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="group relative">
              <h3 className="mt-3 text-lg font-semibold leading-6 text-gray-900 group-hover:text-gray-600">
                <a href={post.href}>
                  <span className="absolute inset-0" />
                  {post.title}
                </a>
              </h3>
              <p className="mt-5 line-clamp-3 text-sm leading-6 text-gray-600">
                {post.description}
              </p>
            </div>

            <div className="relative mt-4 flex items-center gap-x-4">
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
                <p className="font-semibold text-gray-900">{post.authorName}</p>
                <p className="text-gray-600">{post.authorRole}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
