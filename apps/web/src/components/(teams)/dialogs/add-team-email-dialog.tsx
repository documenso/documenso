'use client';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { ZCreateTeamEmailVerificationMutationSchema } from '@documenso/trpc/server/team-router/schema';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useToast } from '@documenso/ui/primitives/use-toast';

export type AddTeamEmailDialogProps = {
  teamId: number;
  trigger?: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZCreateTeamEmailFormSchema = ZCreateTeamEmailVerificationMutationSchema.pick({
  name: true,
  email: true,
});

type TCreateTeamEmailFormSchema = z.infer<typeof ZCreateTeamEmailFormSchema>;

export const AddTeamEmailDialog = ({ teamId, trigger, ...props }: AddTeamEmailDialogProps) => {
  const router = useRouter();

  const [open, setOpen] = useState(false);

  const { toast } = useToast();

  const form = useForm<TCreateTeamEmailFormSchema>({
    resolver: zodResolver(ZCreateTeamEmailFormSchema),
    defaultValues: {
      name: '',
      email: '',
    },
  });

  const { mutateAsync: createTeamEmailVerification, isLoading } =
    trpc.team.createTeamEmailVerification.useMutation();

  const onFormSubmit = async ({ name, email }: TCreateTeamEmailFormSchema) => {
    try {
      await createTeamEmailVerification({
        teamId,
        name,
        email,
      });

      toast({
        title: 'მეილი გაგზავნილია',
        description: 'დამატასტურებელი მეილი წარმატებით გაიგზავნა.',
        duration: 5000,
      });

      router.refresh();

      setOpen(false);
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.ALREADY_EXISTS) {
        form.setError('email', {
          type: 'manual',
          message: 'ამ ელ. ფოსტას სხვა გუნდი იყენებს.',
        });

        return;
      }

      toast({
        title: 'დაფიქსირდა ხარვეზი',
        variant: 'destructive',
        description: 'ამ ელ. ფოსტის დამატებისას დაფიქსირდა ხარვეზი. გთხოვთ თავიდან სცადოთ.',
      });
    }
  };

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog
      {...props}
      open={open}
      onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}
    >
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild={true}>
        {trigger ?? (
          <Button variant="outline" loading={isLoading} className="bg-background">
            <Plus className="-ml-1 mr-1 h-5 w-5" />
            ელ. ფოსტის დამატება
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>დაამატეთ გუნდის ელ.ფოსტა</DialogTitle>

          <DialogDescription className="mt-4">
            დამადასტურებელი მეილი გაიგზავნება მითითებულ ელფოსტაზე.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset
              className="flex h-full flex-col space-y-4"
              disabled={form.formState.isSubmitting}
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>სახელი</FormLabel>
                    <FormControl>
                      <Input className="bg-background" placeholder="eg. Legal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>ელ.ფოსტა</FormLabel>
                    <FormControl>
                      <Input
                        className="bg-background"
                        placeholder="example@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  დახურვა
                </Button>

                <Button type="submit" loading={form.formState.isSubmitting}>
                  დამატება
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
