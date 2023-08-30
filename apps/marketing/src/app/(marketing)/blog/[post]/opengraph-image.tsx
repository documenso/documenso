import { ImageResponse } from 'next/server';

import { allBlogPosts } from 'contentlayer/generated';

export const runtime = 'edge';

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

type BlogPostOpenGraphImageProps = {
  params: { post: string };
};

export default async function BlogPostOpenGraphImage({ params }: BlogPostOpenGraphImageProps) {
  const blogPost = allBlogPosts.find((post) => post._raw.flattenedPath === `blog/${params.post}`);

  if (!blogPost) {
    return null;
  }

  const [interBold, interRegular, backgroundImage, logoImage] = await Promise.all([
    fetch(new URL('./../../../../assets/inter-bold.ttf', import.meta.url)).then(async (res) =>
      res.arrayBuffer(),
    ),
    fetch(new URL('./../../../../assets/inter-regular.ttf', import.meta.url)).then(async (res) =>
      res.arrayBuffer(),
    ),
    fetch(new URL('./../../../../assets/background-blog-og.png', import.meta.url)).then(
      async (res) => res.arrayBuffer(),
    ),
    fetch(new URL('./../../../../../public/logo.png', import.meta.url)).then(async (res) =>
      res.arrayBuffer(),
    ),
  ]);

  return new ImageResponse(
    (
      <div
        tw="relative h-full w-full flex flex-col items-center justify-center text-center"
        // style={{ display: 'flex' }}
      >
        <img src={backgroundImage} alt="og-background" tw="absolute inset-0 w-full h-full" />

        <img src={logoImage} alt="logo" tw="h-8" />

        <h1 tw="mt-8 text-6xl text-center flex items-center justify-center w-full max-w-[800px] font-bold text-center mx-auto">
          {blogPost.title}
        </h1>

        <p tw="font-normal">Written by {blogPost.authorName}</p>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: 'Inter',
          data: interRegular,
          style: 'normal',
          weight: 400,
        },
        {
          name: 'Inter',
          data: interBold,
          style: 'normal',
          weight: 700,
        },
      ],
    },
  );
}
