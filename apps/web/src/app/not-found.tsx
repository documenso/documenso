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
        <div>
          <p className="font-medium leading-relaxed text-[#555E67]">404 Page not found</p>
          <h1 className="mt-3 text-2xl font-semibold text-gray-800 dark:text-white md:text-3xl">
            Oops! You found a secret page
          </h1>
          <p className="mt-4 text-gray-500 dark:text-gray-400">
            The page you are looking for may not exist :/
          </p>
          <div className="mt-6 flex items-center gap-x-3">
            <Button
              size="default"
              className="dark:bg-documenso dark:hover:opacity-90"
              onClick={() => {
                void router.back();
              }}
            >
              <ChevronLeft />
              <span>Go back</span>
            </Button>
            <Button
              size="default"
              variant="secondary"
              onClick={() => {
                void router.push('/dashboard');
              }}
            >
              <span>Dashboard</span>
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
