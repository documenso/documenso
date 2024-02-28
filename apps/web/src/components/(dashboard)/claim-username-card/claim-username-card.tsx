'use client';

import React from 'react';

import Image from 'next/image';

import { File } from 'lucide-react';

import Check from '@documenso/assets/Check.svg';
import Timur from '@documenso/assets/images/Timur.png';
import backgroundPattern from '@documenso/assets/images/background-blog-og.png';
import { cn } from '@documenso/ui/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardFooter, CardHeader } from '@documenso/ui/primitives/card';

type ClaimUsernameCardProps = {
  className: string;
};

export default function ClaimUsernameCard({ className }: ClaimUsernameCardProps) {
  const onSignUpClick = () => {};
  return (
    <div className={cn('relative', className)}>
      <Card className={cn('relative h-full overflow-hidden px-16 py-16 shadow-none')}>
        <Image
          src={backgroundPattern}
          alt="background pattern"
          className="absolute left-0 top-0 h-full w-full bg-cover opacity-50 dark:brightness-95 dark:contrast-[100%] dark:invert"
        />
        <Card className="mt-28 flex flex-col items-center px-6 py-6 shadow-none">
          <code className="rounded-md border-2 border-gray-200 px-1 py-1 text-sm">
            <span>documenso.com/u/timur</span>
          </code>
          <Avatar className="dark:border-border mt-2 h-20 w-20 border-2 border-solid border-white">
            <AvatarImage className="AvatarImage" src={Timur.src} alt="Timur" />
            <AvatarFallback className="text-xs text-gray-400">Timur</AvatarFallback>
          </Avatar>
          <div className="mb-2 flex flex-row gap-x-2">
            Timur Ercan <Image alt="Check" src={Check} />
          </div>
          <span className="text-muted-foreground/60 text-center ">
            Hey I’m Timur <br /> Pick any of the following agreements below and <br /> start signing
            to get started
          </span>
          <Card className="mt-2 w-full items-center shadow-none">
            <CardHeader className="p-4 text-gray-500">Documents</CardHeader>
            <hr className="mb-2" />
            <div className="mb-2 flex flex-row items-center justify-between">
              <div className="flex flex-row items-center gap-x-2">
                <File className="text-muted-foreground ml-3" />
                <div className="flex flex-col">
                  <span className="text-md">NDA.pdf</span>
                  <span className="text-muted-foreground mt-0.5 text-xs">
                    Like to discuss about my work?
                  </span>
                </div>
              </div>
              <Button className="mr-3 px-6" variant="default">
                Sign
              </Button>
            </div>
            <hr className="mb-2" />
            <div className="mb-2 flex flex-row items-center justify-between">
              <div className="flex flex-row items-center gap-x-2">
                <File className="text-muted-foreground ml-3" />
                <div className="flex flex-col">
                  <span className="text-md">NDA.pdf</span>
                  <span className="text-muted-foreground mt-0.5 text-xs">
                    Like to discuss about my work?
                  </span>
                </div>
              </div>
              <Button className="mr-3 px-6" variant="default">
                Sign
              </Button>
            </div>
          </Card>
        </Card>

        <CardFooter className="mt-32 justify-center">
          <Button
            type="button"
            variant="outline"
            className="rounded-full bg-transparent backdrop-blur-sm"
            onClick={onSignUpClick}
          >
            Claim Community Plan
            <span className="bg-primary dark:text-background -mr-2.5 ml-2.5 rounded-full px-2 py-1.5 text-xs font-medium">
              -80%
            </span>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
