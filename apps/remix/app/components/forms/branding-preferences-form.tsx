import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { DEFAULT_BRAND_COLORS, DEFAULT_BRAND_RADIUS } from '@documenso/lib/constants/theme';
import { ZCssVarsSchema } from '@documenso/lib/types/css-vars';
import { cn } from '@documenso/ui/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@documenso/ui/primitives/accordion';
import { Button } from '@documenso/ui/primitives/button';
import { ColorPicker } from '@documenso/ui/primitives/color-picker';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import type { TeamGlobalSettings } from '@prisma/client';
import { Loader } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useOptionalCurrentTeam } from '~/providers/team';
import { useCspNonce } from '~/utils/nonce';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const ZBrandingPreferencesFormSchema = z.object({
  brandingEnabled: z.boolean().nullable(),
  brandingLogo: z
    .instanceof(File)
    .refine((file) => file.size <= MAX_FILE_SIZE, 'File size must be less than 5MB')
    .refine((file) => ACCEPTED_FILE_TYPES.includes(file.type), 'Only .jpg, .png, and .webp files are accepted')
    .nullish(),
  brandingUrl: z.string().url().optional().or(z.literal('')),
  brandingCompanyDetails: z.string().max(500).optional(),
  brandingColors: ZCssVarsSchema.default({}),
  brandingCss: z.string().max(10_000).default(''),
});

export type TBrandingPreferencesFormSchema = z.infer<typeof ZBrandingPreferencesFormSchema>;

type SettingsSubset = Pick<
  TeamGlobalSettings,
  'brandingEnabled' | 'brandingLogo' | 'brandingUrl' | 'brandingCompanyDetails' | 'brandingColors' | 'brandingCss'
>;

export type BrandingPreferencesFormProps = {
  canInherit?: boolean;
  hasAdvancedBranding: boolean;
  settings: SettingsSubset;
  onFormSubmit: (data: TBrandingPreferencesFormSchema) => Promise<void>;
  context: 'Team' | 'Organisation';
};

export function BrandingPreferencesForm({
  canInherit = false,
  hasAdvancedBranding,
  settings,
  onFormSubmit,
  context,
}: BrandingPreferencesFormProps) {
  const { t } = useLingui();
  const nonce = useCspNonce();

  const team = useOptionalCurrentTeam();
  const organisation = useCurrentOrganisation();

  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [hasLoadedPreview, setHasLoadedPreview] = useState(false);

  const parsedColors = ZCssVarsSchema.safeParse(settings.brandingColors);
  const initialColors = parsedColors.success ? parsedColors.data : {};

  const form = useForm<TBrandingPreferencesFormSchema>({
    values: {
      brandingEnabled: settings.brandingEnabled ?? null,
      brandingUrl: settings.brandingUrl ?? '',
      brandingLogo: undefined,
      brandingCompanyDetails: settings.brandingCompanyDetails ?? '',
      brandingColors: initialColors,
      brandingCss: settings.brandingCss ?? '',
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

        setPreviewUrl(logoUrl + '?v=' + Date.now());
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
                    <SelectTrigger className="bg-background text-muted-foreground" data-testid="enable-branding">
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
            {!isBrandingEnabled && <div className="absolute inset-0 z-[9998] bg-background/60" />}

            <FormField
              control={form.control}
              name="brandingLogo"
              render={({ field: { value: _value, onChange, ...field } }) => (
                <FormItem className="flex-1">
                  <FormLabel>
                    <Trans>Branding Logo</Trans>
                  </FormLabel>

                  <div className="flex flex-col gap-4">
                    <div className="relative h-48 w-full overflow-hidden rounded-lg border border-border bg-background">
                      {previewUrl ? (
                        <img src={previewUrl} alt="Logo preview" className="h-full w-full object-contain p-4" />
                      ) : (
                        <div className="relative flex h-full w-full items-center justify-center bg-muted/20 text-muted-foreground text-sm dark:bg-muted">
                          <Trans>Please upload a logo</Trans>

                          {!hasLoadedPreview && (
                            <div className="absolute inset-0 z-[999] flex items-center justify-center bg-muted dark:bg-muted">
                              <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
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

                      <div className="absolute top-0 right-2 inline-flex h-full items-center justify-center">
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
                    <Input type="url" placeholder="https://example.com" disabled={!isBrandingEnabled} {...field} />
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

          {hasAdvancedBranding && (
            <div className="relative flex w-full flex-col gap-y-6">
              {!isBrandingEnabled && <div className="absolute inset-0 z-[9998] bg-background/60" />}

              <div>
                <FormLabel>
                  <Trans>Brand Colours</Trans>
                </FormLabel>

                <FormDescription className="mt-1 mb-4">
                  <Trans>Customise the colours used on your signing pages.</Trans>
                </FormDescription>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="brandingColors.background"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Background</Trans>
                        </FormLabel>
                        <FormDescription>
                          <Trans>Base background colour.</Trans>
                        </FormDescription>
                        <FormControl>
                          <ColorPicker
                            nonce={nonce}
                            value={field.value ?? ''}
                            defaultValue={DEFAULT_BRAND_COLORS.background}
                            onChange={(color) => field.onChange(color)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="brandingColors.foreground"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Foreground</Trans>
                        </FormLabel>
                        <FormDescription>
                          <Trans>Base text colour.</Trans>
                        </FormDescription>
                        <FormControl>
                          <ColorPicker
                            nonce={nonce}
                            value={field.value ?? ''}
                            defaultValue={DEFAULT_BRAND_COLORS.foreground}
                            onChange={(color) => field.onChange(color)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="brandingColors.primary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Primary</Trans>
                        </FormLabel>
                        <FormDescription>
                          <Trans>Primary action colour.</Trans>
                        </FormDescription>
                        <FormControl>
                          <ColorPicker
                            nonce={nonce}
                            value={field.value ?? ''}
                            defaultValue={DEFAULT_BRAND_COLORS.primary}
                            onChange={(color) => field.onChange(color)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="brandingColors.primaryForeground"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Primary Foreground</Trans>
                        </FormLabel>
                        <FormDescription>
                          <Trans>Text colour on primary buttons.</Trans>
                        </FormDescription>
                        <FormControl>
                          <ColorPicker
                            nonce={nonce}
                            value={field.value ?? ''}
                            defaultValue={DEFAULT_BRAND_COLORS.primaryForeground}
                            onChange={(color) => field.onChange(color)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="brandingColors.border"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Border</Trans>
                        </FormLabel>
                        <FormDescription>
                          <Trans>Default border colour.</Trans>
                        </FormDescription>
                        <FormControl>
                          <ColorPicker
                            nonce={nonce}
                            value={field.value ?? ''}
                            defaultValue={DEFAULT_BRAND_COLORS.border}
                            onChange={(color) => field.onChange(color)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="brandingColors.ring"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Ring</Trans>
                        </FormLabel>
                        <FormDescription>
                          <Trans>Focus ring colour.</Trans>
                        </FormDescription>
                        <FormControl>
                          <ColorPicker
                            nonce={nonce}
                            value={field.value ?? ''}
                            defaultValue={DEFAULT_BRAND_COLORS.ring}
                            onChange={(color) => field.onChange(color)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="mt-4">
                  <FormField
                    control={form.control}
                    name="brandingColors.radius"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Border Radius</Trans>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder={DEFAULT_BRAND_RADIUS}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        </FormControl>
                        <FormDescription>
                          <Trans>Border radius size in REM units (e.g. 0.5rem).</Trans>
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Accordion type="single" collapsible>
                <AccordionItem value="custom-css" className="border-none">
                  <AccordionTrigger className="rounded border px-3 py-2 text-left text-foreground hover:bg-muted/40 hover:no-underline">
                    <Trans>Advanced — Custom CSS</Trans>
                  </AccordionTrigger>

                  <AccordionContent className="-mx-1 px-1 pt-4 text-muted-foreground text-sm leading-relaxed">
                    <FormField
                      control={form.control}
                      name="brandingCss"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Textarea
                              placeholder={t`/* Write CSS targeting your signing pages. Selectors are scoped automatically. */
.my-button {
  background: red;
}`}
                              className="min-h-[200px] font-mono text-xs"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>

                          <FormDescription>
                            <Trans>
                              Custom CSS is sanitised on save. Layout-breaking properties, remote URLs, and
                              pseudo-elements are stripped automatically. Any rules dropped during sanitisation will be
                              shown after you save.
                            </Trans>
                          </FormDescription>
                        </FormItem>
                      )}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}

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
