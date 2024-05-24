'use client';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { TeamEmail } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
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

export type UpdateTeamEmailDialogProps = {
  teamEmail: TeamEmail;
  trigger?: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZUpdateTeamEmailFormSchema = z.object({
  name: z.string().trim().min(1, { message: 'გთხოვთ ჩაწერეთ სწორი სახელი.' }),
});

type TUpdateTeamEmailFormSchema = z.infer<typeof ZUpdateTeamEmailFormSchema>;

export const UpdateTeamEmailDialog = ({
  teamEmail,
  trigger,
  ...props
}: UpdateTeamEmailDialogProps) => {
  const router = useRouter();

  const [open, setOpen] = useState(false);

  const { toast } = useToast();

  const form = useForm<TUpdateTeamEmailFormSchema>({
    resolver: zodResolver(ZUpdateTeamEmailFormSchema),
    defaultValues: {
      name: teamEmail.name,
    },
  });

  const { mutateAsync: updateTeamEmail } = trpc.team.updateTeamEmail.useMutation();

  const onFormSubmit = async ({ name }: TUpdateTeamEmailFormSchema) => {
    try {
      await updateTeamEmail({
        teamId: teamEmail.teamId,
        data: {
          name,
        },
      });

      toast({
        title: 'ელ.ფოსტა განახლებულია',
        description: 'გუნდის ელ.ფოსტა წარმატებით განახლდა!',
        duration: 5000,
      });

      router.refresh();

      setOpen(false);
    } catch (err) {
      toast({
        title: 'დაფიქსირდა ხარვეზი',
        variant: 'destructive',
        description:
          'გუნდის ელ.ფოსტის განახლებისას დაფიქსირდა ხარვეზი. გთხოვთ თავიდან სცადოთ ან დაგვიკავშირდეთ.',
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
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild>
        {trigger ?? (
          <Button variant="outline" className="bg-background">
            გუნდის ელ.ფოსტის განახლება
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>განაახლეთ გუნდის ელ.ფოსტა</DialogTitle>

          <DialogDescription className="mt-4">
            ელ.ფოსტის შესაცვლელად თქვენ უნდა წაშალოთ ახლანდელი და დაამატოთ ახალი ელ.ფოსტის
            მისამართი.
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

              <FormItem>
                <FormLabel required>ელ.ფოსტა</FormLabel>
                <FormControl>
                  <Input className="bg-background" value={teamEmail.email} disabled={true} />
                </FormControl>
              </FormItem>

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  დახურვა
                </Button>

                <Button type="submit" loading={form.formState.isSubmitting}>
                  განახლება
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
