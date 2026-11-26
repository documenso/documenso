import { ADMIN_TAG_DESCRIPTION_MAX_LENGTH } from '@documenso/lib/constants/admin-tags';
import { ADMIN_TAG_TYPE_MAP } from '@documenso/lib/constants/admin-tags-translations';
import { ZAdminTagTypeSchema } from '@documenso/lib/types/admin-tags';
import {
  type TAdminTagData,
  ZAdminTagDataSchema,
} from '@documenso/trpc/server/admin-router/tags/create-admin-tag.types';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';

export type AdminTagFormProps = {
  defaultValues?: TAdminTagData;
  onFormSubmit: (data: TAdminTagData) => Promise<void>;
  formSubmitTrigger: React.ReactNode;
};

export const AdminTagForm = ({ defaultValues, onFormSubmit, formSubmitTrigger }: AdminTagFormProps) => {
  const { t } = useLingui();

  const form = useForm<TAdminTagData>({
    resolver: zodResolver(ZAdminTagDataSchema),
    defaultValues: defaultValues ?? {
      type: 'flagged_for_review',
      description: '',
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onFormSubmit)}>
        <fieldset className="flex flex-col gap-y-4" disabled={form.formState.isSubmitting}>
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>
                  <Trans>Tag</Trans>
                </FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ZAdminTagTypeSchema.options.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(ADMIN_TAG_TYPE_MAP[type])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>
                  <Trans>Description</Trans>
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    autoFocus
                    className="min-h-24"
                    maxLength={ADMIN_TAG_DESCRIPTION_MAX_LENGTH}
                    placeholder={t`e.g. Sent 500 documents to unrelated recipients in an hour`}
                  />
                </FormControl>
                <FormDescription>
                  <Trans>Why the tag was added. Only admins can see this.</Trans>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {formSubmitTrigger}
        </fieldset>
      </form>
    </Form>
  );
};
