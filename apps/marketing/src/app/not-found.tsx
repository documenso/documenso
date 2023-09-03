'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';

import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

import backgroundPattern from '~/assets/background-pattern.png';

export default function NotFound() {
  const router = useRouter();
  return (
    <motion.div className={cn('relative')}>
      <div className="absolute -inset-24 -z-10">
        <motion.div
          className="flex h-full w-full origin-top-right items-center justify-center"
          initial="initial"
          animate="animate"
        >
          <Image
            src={backgroundPattern}
            alt="background pattern"
            className="-mr-[50vw] -mt-[15vh] h-full scale-100 object-cover md:scale-100 lg:scale-[100%]"
            priority={true}
          />
        </motion.div>
      </div>
      <div className="container mx-auto flex min-h-screen items-center px-6 py-12">
        <div className="mx-auto flex max-w-sm flex-col items-center text-center">
          <h1 className="mt-3 text-2xl font-semibold text-gray-800 dark:text-white md:text-3xl">
            404 Page not found
          </h1>
          <p className="mt-4 text-gray-500 dark:text-gray-400">
            Sorry, the page you are looking for doesn't exist or has been moved.
          </p>

          <div className="mt-6 flex w-full shrink-0 items-center gap-x-3 sm:w-auto">
            <Button
              size="default"
              onClick={() => {
                void router.back();
              }}
              className="dark:bg-documenso dark:hover:opacity-90"
            >
              <ChevronLeft />
              <span>Go back</span>
            </Button>
            <Button
              size="default"
              onClick={() => {
                void router.push('/');
              }}
              variant="secondary"
            >
              <span>Home</span>
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
