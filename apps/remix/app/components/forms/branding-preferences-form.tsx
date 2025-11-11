import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import type { TeamGlobalSettings } from '@prisma/client';
import { Loader } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Textarea } from '@documenso/ui/primitives/textarea';

import { useOptionalCurrentTeam } from '~/providers/team';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const ZBrandingPreferencesFormSchema = z.object({
  brandingEnabled: z.boolean().nullable(),
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

export type TBrandingPreferencesFormSchema = z.infer<typeof ZBrandingPreferencesFormSchema>;

type SettingsSubset = Pick<
  TeamGlobalSettings,
  'brandingEnabled' | 'brandingLogo' | 'brandingUrl' | 'brandingCompanyDetails'
>;

export type BrandingPreferencesFormProps = {
  canInherit?: boolean;
  settings: SettingsSubset;
  onFormSubmit: (data: TBrandingPreferencesFormSchema) => Promise<void>;
  context: 'Team' | 'Organisation';
};

export function BrandingPreferencesForm({
  canInherit = false,
  settings,
  onFormSubmit,
  context,
}: BrandingPreferencesFormProps) {
  const { t } = useLingui();

  const team = useOptionalCurrentTeam();
  const organisation = useCurrentOrganisation();

  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [hasLoadedPreview, setHasLoadedPreview] = useState(false);

  const form = useForm<TBrandingPreferencesFormSchema>({
    defaultValues: {
      brandingEnabled: settings.brandingEnabled ?? null,
      brandingUrl: settings.brandingUrl ?? '',
      brandingLogo: undefined,
      brandingCompanyDetails: settings.brandingCompanyDetails ?? '',
    },
    resolver: zodResolver(ZBrandingPreferencesFormSchema),
  });

  const isBrandingEnabled = form.watch('brandingEnabled');

  useEffect(() => {
    if (settings.brandingLogo) {
      const file = JSON.parse(settings.brandingLogo);

      if ('type' in file && 'data' in file) {
        const logoUrl =
          context === 'Team'
            ? `${NEXT_PUBLIC_WEBAPP_URL()}/api/branding/logo/team/${team?.id}`
            : `${NEXT_PUBLIC_WEBAPP_URL()}/api/branding/logo/organisation/${organisation?.id}`;

        setPreviewUrl(logoUrl);
        setHasLoadedPreview(true);
      }
    }

    setHasLoadedPreview(true);
  }, [settings.brandingLogo]);

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
      <form onSubmit={form.handleSubmit(onFormSubmit)}>
        <fieldset className="flex h-full flex-col gap-y-4" disabled={form.formState.isSubmitting}>
          <FormField
            control={form.control}
            name="brandingEnabled"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>
                  <Trans>Enable Custom Branding</Trans>
                </FormLabel>

                <FormControl>
                  <Select
                    {...field}
                    value={field.value === null ? '-1' : field.value.toString()}
                    onValueChange={(value) =>
                      field.onChange(value === 'true' ? true : value === 'false' ? false : null)
                    }
                  >
                    <SelectTrigger
                      className="bg-background text-muted-foreground"
                      data-testid="enable-branding"
                    >
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent className="z-[9999]">
                      <SelectItem value="true">
                        <Trans>Yes</Trans>
                      </SelectItem>

                      <SelectItem value="false">
                        <Trans>No</Trans>
                      </SelectItem>

                      {canInherit && (
                        <SelectItem value={'-1'}>
                          <Trans>Inherit from organisation</Trans>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </FormControl>

                <FormDescription>
                  {context === 'Team' ? (
                    <Trans>Enable custom branding for all documents in this team</Trans>
                  ) : (
                    <Trans>Enable custom branding for all documents in this organisation</Trans>
                  )}
                </FormDescription>
              </FormItem>
            )}
          />

          <div className="relative flex w-full flex-col gap-y-4">
            {!isBrandingEnabled && <div className="bg-background/60 absolute inset-0 z-[9998]" />}

            <FormField
              control={form.control}
              name="brandingLogo"
              render={({ field: { value: _value, onChange, ...field } }) => (
                <FormItem className="flex-1">
                  <FormLabel>
                    <Trans>Branding Logo</Trans>
                  </FormLabel>

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
                          <Trans>Please upload a logo</Trans>

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

                      {canInherit && (
                        <span>
                          {'. '}
                          <Trans>Leave blank to inherit from the organisation.</Trans>
                        </span>
                      )}
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
                  <FormLabel>
                    <Trans>Brand Website</Trans>
                  </FormLabel>

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

                    {canInherit && (
                      <span>
                        {'. '}
                        <Trans>Leave blank to inherit from the organisation.</Trans>
                      </span>
                    )}
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="brandingCompanyDetails"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>
                    <Trans>Brand Details</Trans>
                  </FormLabel>

                  <FormControl>
                    <Textarea
                      placeholder={t`Enter your brand details`}
                      className="min-h-[100px] resize-y"
                      disabled={!isBrandingEnabled}
                      {...field}
                    />
                  </FormControl>

                  <FormDescription>
                    <Trans>Additional brand information to display at the bottom of emails</Trans>

                    {canInherit && (
                      <span>
                        {'. '}
                        <Trans>Leave blank to inherit from the organisation.</Trans>
                      </span>
                    )}
                  </FormDescription>
                </FormItem>
              )}
            />
          </div>

          <div className="flex flex-row justify-end space-x-4">
            <Button type="submit" loading={form.formState.isSubmitting}>
              <Trans>Update</Trans>
            </Button>
          </div>
        </fieldset>
      </form>
    </Form>
  );
}
