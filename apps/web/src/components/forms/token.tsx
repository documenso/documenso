'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import { TRPCClientError } from '@documenso/trpc/client';
import { trpc } from '@documenso/trpc/react';
import type { TCreateTokenMutationSchema } from '@documenso/trpc/server/api-token-router/schema';
import { ZCreateTokenMutationSchema } from '@documenso/trpc/server/api-token-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Switch } from '@documenso/ui/primitives/switch';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { EXPIRATION_DATES } from '../(dashboard)/settings/token/contants';

const ZCreateTokenFormSchema = ZCreateTokenMutationSchema.extend({
  enabled: z.boolean(),
});

type TCreateTokenFormSchema = z.infer<typeof ZCreateTokenFormSchema>;

export type ApiTokenFormProps = {
  className?: string;
  teamId?: number;
};

export const ApiTokenForm = ({ className, teamId }: ApiTokenFormProps) => {
  const router = useRouter();

  const [, copy] = useCopyToClipboard();
  const { toast } = useToast();

  const [newlyCreatedToken, setNewlyCreatedToken] = useState('');
  const [noExpirationDate, setNoExpirationDate] = useState(false);

  const { mutateAsync: createTokenMutation } = trpc.apiToken.createToken.useMutation({
    onSuccess(data) {
      setNewlyCreatedToken(data.token);
    },
  });

  const form = useForm<TCreateTokenFormSchema>({
    resolver: zodResolver(ZCreateTokenFormSchema),
    defaultValues: {
      tokenName: '',
      expirationDate: '',
      enabled: false,
    },
  });

  const copyToken = async (token: string) => {
    try {
      const copied = await copy(token);

      if (!copied) {
        throw new Error('ტოკენი ვერ დაკოპირდა');
      }

      toast({
        title: 'ტოკენი დაკოპირებულია',
        description: 'ტოკენი წარმატებით დაკოპირდა.',
      });
    } catch (error) {
      toast({
        title: 'ტოკენი ვერ დაკოპირდა',
        description: 'ტოკენის დაკოპირება ვერ მოხერხდა. გთხოვთ თავიდან სცადოთ.',
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async ({ tokenName, expirationDate }: TCreateTokenMutationSchema) => {
    try {
      await createTokenMutation({
        teamId,
        tokenName,
        expirationDate: noExpirationDate ? null : expirationDate,
      });

      toast({
        title: 'ტოკენი შექმნილია',
        description: 'ახალი ტოკენი წარმატებით შეიქმნა.',
        duration: 5000,
      });

      form.reset();

      router.refresh();
    } catch (error) {
      if (error instanceof TRPCClientError && error.data?.code === 'BAD_REQUEST') {
        toast({
          title: 'დაფიქსირდა ხარვეზი',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'დაფიქსირდა ხარვეზი',
          variant: 'destructive',
          duration: 5000,
          description:
            'ახალი ტოკენის შექმნისას დაფიქსირდა ხარვეზი. გთხოვთ თავიდან სცადოთ ან დაგვიკავშირდეთ.',
        });
      }
    }
  };

  return (
    <div className={cn(className)}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset className="mt-6 flex w-full flex-col gap-4">
            <FormField
              control={form.control}
              name="tokenName"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel className="text-muted-foreground">ტოკენის სახელი</FormLabel>

                  <div className="flex items-center gap-x-4">
                    <FormControl className="flex-1">
                      <Input type="text" {...field} />
                    </FormControl>
                  </div>

                  <FormDescription className="text-xs italic">
                    გთხოვთ აურჩიოთ ტოკენს რელევანტური სახელი, რაც შემდეგ მის ამოცნობაში დაგეხმარებთ
                  </FormDescription>

                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-4 md:flex-row">
              <FormField
                control={form.control}
                name="expirationDate"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel className="text-muted-foreground">
                      ტოკენის ვადის გასვლის თარიღი
                    </FormLabel>

                    <div className="flex items-center gap-x-4">
                      <FormControl className="flex-1">
                        <Select onValueChange={field.onChange} disabled={noExpirationDate}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Choose..." />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(EXPIRATION_DATES).map(([key, date]) => (
                              <SelectItem key={key} value={key}>
                                {date}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </div>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="">
                    <FormLabel className="text-muted-foreground mt-2">უვადო</FormLabel>
                    <FormControl>
                      <div className="block md:py-1.5">
                        <Switch
                          className="bg-background"
                          checked={field.value}
                          onCheckedChange={(val) => {
                            setNoExpirationDate((prev) => !prev);
                            field.onChange(val);
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              className="hidden md:inline-flex"
              disabled={!form.formState.isDirty}
              loading={form.formState.isSubmitting}
            >
              ტოკენის შექმნა
            </Button>

            <div className="md:hidden">
              <Button
                type="submit"
                disabled={!form.formState.isDirty}
                loading={form.formState.isSubmitting}
              >
                ტოკენის შექმნა
              </Button>
            </div>
          </fieldset>
        </form>
      </Form>

      {newlyCreatedToken && (
        <Card className="mt-8" gradient>
          <CardContent className="p-4">
            <p className="text-muted-foreground mt-2 text-sm">
              თქვენი ტოკენი წარმატებით შეიქმნა! დარწმუნდით, რომ დააკოპირეთ, რადგან ვეღარ იხილავთ
              მას!
            </p>

            <p className="bg-muted-foreground/10 my-4 rounded-md px-2.5 py-1 font-mono text-sm">
              {newlyCreatedToken}
            </p>

            <Button variant="outline" onClick={() => void copyToken(newlyCreatedToken)}>
              ტოკენის დაკოპირება
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
