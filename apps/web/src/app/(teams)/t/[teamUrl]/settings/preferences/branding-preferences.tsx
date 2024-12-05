'use client';

import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { Loader } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { getFile } from '@documenso/lib/universal/upload/get-file';
import { putFile } from '@documenso/lib/universal/upload/put-file';
import type { Team, TeamGlobalSettings } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Switch } from '@documenso/ui/primitives/switch';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { useToast } from '@documenso/ui/primitives/use-toast';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const ZTeamBrandingPreferencesFormSchema = z.object({
  brandingEnabled: z.boolean(),
  brandingLogo: z
    .instanceof(File)
    .refine((file) => file.size <= MAX_FILE_SIZE, 'File size must be less than 5MB')
    .refine(
      (file) => ACCEPTED_FILE_TYPES.includes(file.type),
      'Only .jpg, .png, and .webp files are accepted',
    )
    .nullish(),
  brandingUrl: z.string().url().optional().or(z.literal('')),
  brandingCompanyDetails: z.string().max(500).optional(),
});

type TTeamBrandingPreferencesFormSchema = z.infer<typeof ZTeamBrandingPreferencesFormSchema>;

export type TeamBrandingPreferencesFormProps = {
  team: Team;
  settings?: TeamGlobalSettings | null;
};

export function TeamBrandingPreferencesForm({ team, settings }: TeamBrandingPreferencesFormProps) {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [hasLoadedPreview, setHasLoadedPreview] = useState(false);

  const { mutateAsync: updateTeamBrandingSettings } =
    trpc.team.updateTeamBrandingSettings.useMutation();

  const form = useForm<TTeamBrandingPreferencesFormSchema>({
    defaultValues: {
      brandingEnabled: settings?.brandingEnabled ?? false,
      brandingUrl: settings?.brandingUrl ?? '',
      brandingLogo: undefined,
      brandingCompanyDetails: settings?.brandingCompanyDetails ?? '',
    },
    resolver: zodResolver(ZTeamBrandingPreferencesFormSchema),
  });

  const isBrandingEnabled = form.watch('brandingEnabled');

  const onSubmit = async (data: TTeamBrandingPreferencesFormSchema) => {
    try {
      const { brandingEnabled, brandingLogo, brandingUrl, brandingCompanyDetails } = data;

      let uploadedBrandingLogo = settings?.brandingLogo;

      if (brandingLogo) {
        uploadedBrandingLogo = JSON.stringify(await putFile(brandingLogo));
      }

      if (brandingLogo === null) {
        uploadedBrandingLogo = '';
      }

      await updateTeamBrandingSettings({
        teamId: team.id,
        settings: {
          brandingEnabled,
          brandingLogo: uploadedBrandingLogo,
          brandingUrl,
          brandingCompanyDetails,
        },
      });

      toast({
        title: _(msg`Branding preferences updated`),
        description: _(msg`Your branding preferences have been updated`),
      });
    } catch (err) {
      toast({
        title: _(msg`Something went wrong`),
        description: _(
          msg`We were unable to update your branding preferences at this time, please try again later`,
        ),
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (settings?.brandingLogo) {
      const file = JSON.parse(settings.brandingLogo);

      if ('type' in file && 'data' in file) {
        void getFile(file).then((binaryData) => {
          const objectUrl = URL.createObjectURL(new Blob([binaryData]));

          setPreviewUrl(objectUrl);
          setHasLoadedPreview(true);
        });

        return;
      }
    }

    setHasLoadedPreview(true);
  }, [settings?.brandingLogo]);

  // Cleanup ObjectURL on unmount or when previewUrl changes
  useEffect(() => {
    return () => {
      if (previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <fieldset
          className="flex h-full max-w-xl flex-col gap-y-4"
          disabled={form.formState.isSubmitting}
        >
          <FormField
            control={form.control}
            name="brandingEnabled"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Enable Custom Branding</FormLabel>

                <div>
                  <FormControl>
                    <Switch
                      ref={field.ref}
                      name={field.name}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </div>

                <FormDescription>
                  <Trans>Enable custom branding for all documents in this team.</Trans>
                </FormDescription>
              </FormItem>
            )}
          />

          <div className="relative flex w-full flex-col gap-y-4">
            {!isBrandingEnabled && <div className="bg-background/60 absolute inset-0 z-[9999]" />}

            <FormField
              control={form.control}
              name="brandingLogo"
              render={({ field: { value: _value, onChange, ...field } }) => (
                <FormItem className="flex-1">
                  <FormLabel>Branding Logo</FormLabel>

                  <div className="flex flex-col gap-4">
                    <div className="border-border bg-background relative h-48 w-full overflow-hidden rounded-lg border">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt="Logo preview"
                          className="h-full w-full object-contain p-4"
                        />
                      ) : (
                        <div className="bg-muted/20 dark:bg-muted text-muted-foreground relative flex h-full w-full items-center justify-center text-sm">
                          Please upload a logo
                          {!hasLoadedPreview && (
                            <div className="bg-muted dark:bg-muted absolute inset-0 z-[999] flex items-center justify-center">
                              <Loader className="text-muted-foreground h-8 w-8 animate-spin" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <FormControl className="relative">
                        <Input
                          type="file"
                          accept={ACCEPTED_FILE_TYPES.join(',')}
                          disabled={!isBrandingEnabled}
                          onChange={(e) => {
                            const file = e.target.files?.[0];

                            if (file) {
                              if (previewUrl.startsWith('blob:')) {
                                URL.revokeObjectURL(previewUrl);
                              }

                              const objectUrl = URL.createObjectURL(file);

                              setPreviewUrl(objectUrl);

                              onChange(file);
                            }
                          }}
                          className={cn(
                            'h-auto p-2',
                            'file:text-primary hover:file:bg-primary/90',
                            'file:mr-4 file:cursor-pointer file:rounded-md file:border-0',
                            'file:p-2 file:py-2 file:font-medium',
                            'file:bg-primary file:text-primary-foreground',
                            !isBrandingEnabled && 'cursor-not-allowed',
                          )}
                          {...field}
                        />
                      </FormControl>

                      <div className="absolute right-2 top-0 inline-flex h-full items-center justify-center">
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="text-destructive text-xs"
                          onClick={() => {
                            setPreviewUrl('');
                            onChange(null);
                          }}
                        >
                          <Trans>Remove</Trans>
                        </Button>
                      </div>
                    </div>

                    <FormDescription>
                      <Trans>Upload your brand logo (max 5MB, JPG, PNG, or WebP)</Trans>
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="brandingUrl"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Brand Website</FormLabel>

                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://example.com"
                      disabled={!isBrandingEnabled}
                      {...field}
                    />
                  </FormControl>

                  <FormDescription>
                    <Trans>Your brand website URL</Trans>
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="brandingCompanyDetails"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Brand Details</FormLabel>

                  <FormControl>
                    <Textarea
                      placeholder={_(msg`Enter your brand details`)}
                      className="min-h-[100px] resize-y"
                      disabled={!isBrandingEnabled}
                      {...field}
                    />
                  </FormControl>

                  <FormDescription>
                    <Trans>Additional brand information to display at the bottom of emails</Trans>
                  </FormDescription>
                </FormItem>
              )}
            />
          </div>

          <div className="flex flex-row justify-end space-x-4">
            <Button type="submit" loading={form.formState.isSubmitting}>
              <Trans>Save</Trans>
            </Button>
          </div>
        </fieldset>
      </form>
    </Form>
  );
}
