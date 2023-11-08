import Image from 'next/image';

import { z } from 'zod';

import backgroundPattern from '~/assets/background-pattern.png';

import { OSSFriendsContainer } from './container';
import { TOSSFriendsSchema, ZOSSFriendsSchema } from './schema';

export default async function OSSFriendsPage() {
  const ossFriends: TOSSFriendsSchema = await fetch('https://formbricks.com/api/oss-friends', {
    next: {
      revalidate: 3600,
    },
  })
    .then(async (res) => res.json())
    .then(async (data) => z.object({ data: ZOSSFriendsSchema }).parseAsync(data))
    .then(({ data }) => data)
    .catch(() => []);

  return (
    <div className="relative mt-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold lg:text-5xl">
          Our <span title="Open Source Software">OSS</span> Friends
        </h1>

        <p className="text-foreground mx-auto mt-4 max-w-[55ch] text-lg leading-normal">
          We love open source and so should you, below you can find a list of our friends who are
          just as passionate about open source as we are.
        </p>
      </div>

      <OSSFriendsContainer className="mt-12" ossFriends={ossFriends} />

      <div className="absolute inset-0 -z-10 flex items-start justify-center">
        <Image
          src={backgroundPattern}
          alt="background pattern"
          className="-mr-[15vw] -mt-[15vh] h-full max-h-[150vh] scale-125 object-cover dark:contrast-[70%] dark:invert dark:sepia md:-mr-[50vw] md:scale-150 lg:scale-[175%]"
        />
      </div>
    </div>
  );
}
