'use client';

import React from 'react';

import Image from 'next/image';

import { BadgeCheck, File } from 'lucide-react';

import Timur from '@documenso/assets/images/Timur.png';
import backgroundPattern from '@documenso/assets/images/background-blog-og.png';
import { cn } from '@documenso/ui/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardFooter, CardHeader } from '@documenso/ui/primitives/card';

export default function ClaimUsernameCard() {
  const onSignUpClick = () => {};
  return (
    <div className="relative">
      <div className="absolute -inset-96 -z-[1] flex items-center justify-center bg-contain opacity-50">
        <Image
          src={backgroundPattern}
          alt="background pattern"
          className="dark:brightness-95 dark:contrast-[100%] dark:invert"
        />
      </div>
      <Card className={cn('relative px-16 py-16')}>
        <Card className="flex flex-col items-center px-6 py-6">
          <code className="bg-muted rounded-md px-1 py-1 text-sm">
            <span>documenso.com/u/timur</span>
          </code>
          <Avatar className="dark:border-border mt-2 h-12 w-12 border-2 border-solid border-white">
            <AvatarImage className="AvatarImage" src={Timur.src} alt="Timur" />
            <AvatarFallback className="text-xs text-gray-400">Timur</AvatarFallback>
          </Avatar>
          <div className="flex flex-row gap-x-2">
            Timur Ercan <BadgeCheck fill="#A2E771" />
          </div>
          <span className="text-center">
            Hey I’m Timur <br /> Pick any of the following agreements below and start signing to get
            started
          </span>
        </Card>
        <Card className="mt-2 items-center">
          <CardHeader className="p-2">Documents</CardHeader>
          <hr className="mb-2" />
          <div className="mb-2 flex flex-row items-center justify-between">
            <div className="flex flex-row items-center gap-x-2">
              <File className="ml-3" />
              <div className="flex flex-col">
                <span className="text-md">NDA.pdf</span>
                <span className="text-muted-foregroun mt-0.5 text-xs">
                  Like to discuss about my work?
                </span>
              </div>
            </div>
            <Button className="mr-3" variant="default">
              Sign
            </Button>
          </div>
          <hr className="mb-2" />
          <div className="mb-2 flex flex-row items-center justify-between">
            <div className="flex flex-row items-center gap-x-2">
              <File className="ml-3" />
              <div className="flex flex-col">
                <span className="text-md">NDA.pdf</span>
                <span className="text-muted-foregroun mt-0.5 text-xs">
                  Like to discuss about my work?
                </span>
              </div>
            </div>
            <Button className="mr-3" variant="default">
              Sign
            </Button>
          </div>
        </Card>
        <CardFooter className="mt-20 justify-center">
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
