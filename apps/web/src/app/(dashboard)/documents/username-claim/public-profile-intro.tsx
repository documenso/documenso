'use client';

import React, { useRef, useState } from 'react';

import Image from 'next/image';

import { zodResolver } from '@hookform/resolvers/zod';
import { File } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import Check from '@documenso/assets/Check.svg';
import Lucas from '@documenso/assets/images/Lucas.png';
import Timur from '@documenso/assets/images/Timur.png';
import type { User } from '@documenso/prisma/client';
import { TRPCClientError } from '@documenso/trpc/client';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardHeader } from '@documenso/ui/primitives/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { useToast } from '@documenso/ui/primitives/use-toast';

export const ZPublicProfileFormSchema = z.object({
  profileURL: z.string().trim().min(1, { message: 'Please enter a valid URL slug.' }),
});

export type TPublicProfileFormSchema = z.infer<typeof ZPublicProfileFormSchema>;

export type PublicProfileIntroProps = {
  user: User;
};

export const PublicProfileIntro = ({ user }: PublicProfileIntroProps) => {
  const form = useForm<TPublicProfileFormSchema>({
    values: {
      profileURL: user.profileURL || '',
    },
    resolver: zodResolver(ZPublicProfileFormSchema),
  });
  const textRef = useRef<HTMLSpanElement>(null);

  const { toast } = useToast();
  const { mutateAsync: updatePublicProfile } = trpc.profile.updatePublicProfile.useMutation();
  const isSaving = form.formState.isSubmitting;

  const isProfileURLClaimed = user.profileURL ? false : true;
  const [showClaimingDialog, setShowClaimingDialog] = useState(isProfileURLClaimed);
  const [showClaimedDialog, setShowClaimedDialog] = useState(true);

  const onFormSubmit = async ({ profileURL }: TPublicProfileFormSchema) => {
    try {
      await updatePublicProfile({
        profileURL,
      });
      setShowClaimingDialog(false);
      setShowClaimedDialog(true);
    } catch (err) {
      if (err instanceof TRPCClientError && err.data?.code === 'BAD_REQUEST') {
        toast({
          title: 'An error occurred',
          description: err.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'An unknown error occurred',
          variant: 'destructive',
          description:
            'We encountered an unknown error while attempting to save your details. Please try again later.',
        });
      }
    }
  };

  return (
    <>
      <Dialog open={showClaimingDialog} onOpenChange={setShowClaimingDialog}>
        <DialogContent position="center" className="pb-4">
          <DialogHeader>
            <DialogTitle className="font-semi-bold text-center text-2xl">
              Introducing public profile!
            </DialogTitle>
            <DialogDescription className="text-muted-foreground/60 text-center text-sm">
              Reserve your Documenso public profile username
            </DialogDescription>
          </DialogHeader>

          <Card className="relative flex flex-col items-center border-none bg-gray-50 px-6 py-6 pb-0 shadow-none">
            <code className="rounded-md border-2 border-gray-200 px-1 py-1 text-sm">
              <span>documenso.com/u/timur</span>
            </code>
            <Avatar className="dark:border-border mt-2 h-20 w-20 border-2 border-solid border-white bg-white">
              <AvatarImage className="AvatarImage" src={Timur.src} alt="Timur" />
              <AvatarFallback className="text-xs text-gray-400">Timur</AvatarFallback>
            </Avatar>
            <div className="flex flex-row gap-x-2">
              Timur Ercan <Image alt="Check" src={Check} />
            </div>
            <span className="text-muted-foreground/60 text-center">
              Hey I’m Timur <br /> Pick any of the following agreements below and start signing to
              get started
            </span>
            <Card className="bg mt-2 w-full items-center shadow-none">
              <CardHeader className="p-4 text-gray-500">Documents</CardHeader>
              <hr className="mb-2" />
              <div className="mb-2 flex flex-row items-center justify-between">
                <div className="flex flex-row items-center gap-x-2">
                  <File className="ml-3" />
                  <div className="flex flex-col">
                    <span className="text-md">NDA.pdf</span>
                    <span className="text-muted-foreground mt-0.5 text-xs">
                      Like to discuss about my work?
                    </span>
                  </div>
                </div>
                <Button className="mr-3" variant="default">
                  Sign
                </Button>
              </div>
            </Card>
            <div
              className="fade-overlay bg-black-100 absolute bottom-0 h-1/4 w-full"
              style={{
                background: `linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, white 75%, white 100%)`,
              }}
            ></div>
          </Card>

          <Form {...form}>
            <form className={cn('flex w-full flex-col')} onSubmit={form.handleSubmit(onFormSubmit)}>
              <fieldset className="flex w-full flex-col gap-y-4" disabled={isSaving}>
                <FormField
                  control={form.control}
                  name="profileURL"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Public profile URL</FormLabel>
                      <FormControl>
                        <>
                          <Input type="text" className="mb-2 mt-2" {...field} />
                          <div className="mt-2">
                            <code className="bg-muted rounded-md px-1 py-1 text-sm">
                              <span ref={textRef} id="textToCopy">
                                documenso.com/u/
                              </span>
                            </code>
                          </div>
                        </>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </fieldset>

              <div className="mt-4 text-center">
                <Button type="submit" loading={isSaving}>
                  Claim your username
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <Dialog open={false} onOpenChange={setShowClaimedDialog}>
        <DialogContent position="center" className="pb-4">
          <DialogHeader>
            <DialogTitle className="font-semi-bold text-center text-xl">All set!</DialogTitle>
            <DialogDescription className="text-center">
              We will let you know as soon as this feature is launched
            </DialogDescription>
          </DialogHeader>

          <Card className="relative px-6 py-6">
            <Card className="flex flex-col items-center px-6 py-6">
              <code className="bg-muted rounded-md px-1 py-1 text-sm">
                <span>documenso.com/u/lucas</span>
              </code>
              <Avatar className="dark:border-border mt-2 h-12 w-12 border-2 border-solid border-white">
                <AvatarImage className="AvatarImage" src={Lucas.src} alt="Lucas" />
                <AvatarFallback className="text-xs text-gray-400">Timur</AvatarFallback>
              </Avatar>
              <div className="flex flex-row gap-x-2">
                Lucas Smith <Image alt="Check" src={Check} />
              </div>
              <div className="flex inline-flex h-full w-full flex-col items-center justify-center gap-3 py-2">
                <Skeleton className="w-75 h-4 animate-none rounded-full" />
                <Skeleton className="w-50 h-4 animate-none rounded-full" />
              </div>
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
            </Card>
          </Card>
        </DialogContent>
      </Dialog>
    </>
  );
};
