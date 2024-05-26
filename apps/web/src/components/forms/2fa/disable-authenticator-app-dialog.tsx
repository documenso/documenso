'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { flushSync } from 'react-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogClose,
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
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

export const ZDisable2FAForm = z.object({
  token: z.string(),
});

export type TDisable2FAForm = z.infer<typeof ZDisable2FAForm>;

export const DisableAuthenticatorAppDialog = () => {
  const router = useRouter();

  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);

  const { mutateAsync: disable2FA } = trpc.twoFactorAuthentication.disable.useMutation();

  const disable2FAForm = useForm<TDisable2FAForm>({
    defaultValues: {
      token: '',
    },
    resolver: zodResolver(ZDisable2FAForm),
  });

  const { isSubmitting: isDisable2FASubmitting } = disable2FAForm.formState;

  const onDisable2FAFormSubmit = async ({ token }: TDisable2FAForm) => {
    try {
      await disable2FA({ token });

      toast({
        title: 'ორფაქტორიანი ავთენტიფიკაცია გამორთულია',
        description:
          'ორფაქტორიანი ავთენტიფიკაცია გამორთულია. სისტემაში შესვლისას აღარ მოგიწევთ კოდის შეყვანა თქვენი ავთენტიფიკატორის აპლიკაციიდან.',
      });

      flushSync(() => {
        setIsOpen(false);
      });

      router.refresh();
    } catch (_err) {
      toast({
        title: 'ორფაქტორიანი ავთენტიფიკაცია გამორთვა ვერ მოხერხდა',
        description:
          'თქვენი ანგარიშისთვის ორფაქტორიანი ავთენტიფიკაციის გამორთვა ვერ მოხერხდა. გთხოვთ დარწმუნდით, რომ სწორად შეიყვანეთ პაროლი და სარეზერვო კოდი და სცადეთ თავიდან.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild={true}>
        <Button className="flex-shrink-0" variant="destructive">
          გააუქმეთ 2FA
        </Button>
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>გააუქმეთ 2FA</DialogTitle>

          <DialogDescription>
            გთხოვთ მოგვაწოდოთ ტოკენი ავთენტიფიკატორიდან ან სარეზერვო კოდი. თუ არ გაქვთ სარეზერვო
            კოდი, გთხოვთ დაგვიკავშირდეთ.
          </DialogDescription>
        </DialogHeader>

        <Form {...disable2FAForm}>
          <form onSubmit={disable2FAForm.handleSubmit(onDisable2FAFormSubmit)}>
            <fieldset className="flex flex-col gap-y-4" disabled={isDisable2FASubmitting}>
              <FormField
                name="token"
                control={disable2FAForm.control}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input {...field} placeholder="ტოკენი" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    დახურვა
                  </Button>
                </DialogClose>

                <Button type="submit" variant="destructive" loading={isDisable2FASubmitting}>
                  2FA-ს გაუქმება
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
