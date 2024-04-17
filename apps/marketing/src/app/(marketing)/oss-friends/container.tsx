'use client';

import Link from 'next/link';

import { Variants, motion } from 'framer-motion';

import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent, CardTitle } from '@documenso/ui/primitives/card';

import { TOSSFriendsSchema } from './schema';

const ContainerVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.075,
    },
  },
};

const CardVariants: Variants = {
  initial: {
    opacity: 0,
    y: 50,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

const randomDegrees = () => {
  const degrees = [45, 120, -140, -45];

  return degrees[Math.floor(Math.random() * degrees.length)];
};

export type OSSFriendsContainerProps = {
  className?: string;
  ossFriends: TOSSFriendsSchema;
};

export const OSSFriendsContainer = ({ className, ossFriends }: OSSFriendsContainerProps) => {
  return (
    <motion.div
      className={cn('grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3', className)}
      variants={ContainerVariants}
      initial="initial"
      animate="animate"
    >
      {ossFriends.map((friend, index) => (
        <motion.div key={index} className="h-full w-full" variants={CardVariants}>
          <Card
            className="h-full"
            degrees={randomDegrees()}
            gradient={index % 2 === 0}
            spotlight={index % 2 !== 0}
          >
            <CardContent className="flex h-full flex-col p-6">
              <CardTitle>
                <Link href={friend.href}>{friend.name}</Link>
              </CardTitle>

              <p className="text-foreground mt-4 flex-1 text-sm">{friend.description}</p>

              <div className="mt-8">
                <Link target="_blank" href={friend.href}>
                  <Button>Learn more</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
};
