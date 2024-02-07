import { ImageResponse } from 'next/og';

import { allBlogPosts } from 'contentlayer/generated';

export const runtime = 'edge';

export const contentType = 'image/png';

export const IMAGE_SIZE = {
  width: 1200,
  height: 630,
};

type BlogPostOpenGraphImageProps = {
  params: { post: string };
};

export default async function BlogPostOpenGraphImage({ params }: BlogPostOpenGraphImageProps) {
  const blogPost = allBlogPosts.find((post) => post._raw.flattenedPath === `blog/${params.post}`);

  if (!blogPost) {
    return null;
  }

  // The long urls are needed for a compiler optimisation on the Next.js side, lifting this up
  // to a constant will break og image generation.
  const [interBold, interRegular, backgroundImage, logoImage] = await Promise.all([
    fetch(new URL('@documenso/assets/fonts/inter-bold.ttf', import.meta.url)).then(async (res) =>
      res.arrayBuffer(),
    ),
    fetch(new URL('@documenso/assets/fonts/inter-regular.ttf', import.meta.url)).then(async (res) =>
      res.arrayBuffer(),
    ),
    fetch(new URL('@documenso/assets/images/background-blog-og.png', import.meta.url)).then(
      async (res) => res.arrayBuffer(),
    ),
    fetch(new URL('@documenso/assets/logo.png', import.meta.url)).then(async (res) =>
      res.arrayBuffer(),
    ),
  ]);

  return new ImageResponse(
    (
      <div tw="relative h-full w-full flex flex-col items-center justify-center text-center bg-white">
        {/* @ts-expect-error Lack of typing from ImageResponse */}
        <img src={backgroundImage} alt="og-background" tw="absolute inset-0 w-full h-full" />

        {/* @ts-expect-error Lack of typing from ImageResponse */}
        <img src={logoImage} alt="logo" tw="h-8" />

        <h1 tw="mt-8 text-6xl text-center flex items-center justify-center w-full max-w-[800px] font-bold text-center mx-auto">
          {blogPost.title}
        </h1>

        <p tw="font-normal">Written by {blogPost.authorName}</p>
      </div>
    ),
    {
      ...IMAGE_SIZE,
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
