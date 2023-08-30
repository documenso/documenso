import { ImageResponse } from 'next/server';

import { allBlogPosts } from 'contentlayer/generated';

export const runtime = 'edge';

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

const OG_IMAGE_ASSETS = [
  './../../../../assets/inter-bold.ttf',
  './../../../../assets/inter-regular.ttf',
  './../../../../assets/background-blog-og.png',
  './../../../../../public/logo.png',
];

type BlogPostOpenGraphImageProps = {
  params: { post: string };
};

export default async function BlogPostOpenGraphImage({ params }: BlogPostOpenGraphImageProps) {
  const blogPost = allBlogPosts.find((post) => post._raw.flattenedPath === `blog/${params.post}`);

  if (!blogPost) {
    return null;
  }

  const [interBold, interRegular, backgroundImage, logoImage] = await Promise.all(
    OG_IMAGE_ASSETS.map(async (asset) =>
      fetch(new URL(asset, import.meta.url)).then(async (res) => res.arrayBuffer()),
    ),
  );

  return new ImageResponse(
    (
      <div tw="relative h-full w-full flex flex-col items-center justify-center text-center">
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
