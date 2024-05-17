'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';

import backgroundPattern from '@documenso/assets/images/background-pattern.png';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className={cn('relative max-w-[100vw] overflow-hidden')}>
      <div className="absolute -inset-24 -z-10">
        <motion.div
          className="flex h-full w-full items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8, transition: { duration: 0.5, delay: 0.5 } }}
        >
          <Image
            src={backgroundPattern}
            alt="background pattern"
            className="-mr-[50vw] -mt-[15vh] h-full scale-100 object-cover dark:contrast-[70%] dark:invert dark:sepia md:scale-100 lg:scale-[100%]"
            priority
          />
        </motion.div>
      </div>

      <div className="container mx-auto flex h-full min-h-screen items-center px-6 py-32">
        <div>
          <p className="text-muted-foreground font-semibold">404 გვერდი არ მოიძებნა</p>

          <h1 className="mt-3 text-2xl font-bold md:text-3xl">დაფიქსირდა ხარვეზი</h1>

          <p className="text-muted-foreground mt-4 text-sm">
            გვერდი, რომელსაც ეძებთ, წაიშალა, გადაარქვეა სახელი ან შესაძლოა არასოდეს არსებობდა.
          </p>

          <div className="mt-6 flex gap-x-2.5 gap-y-4 md:items-center">
            <Button
              variant="ghost"
              className="w-32"
              onClick={() => {
                void router.back();
              }}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              უკან
            </Button>

            <Button className="w-32" asChild>
              <Link href="/">მთავარი</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
