import { ZNameSchema } from '@documenso/lib/types/name';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const ZEmailTransportFormSchema = z.object({
  name: ZNameSchema,
  fromName: ZNameSchema,
  fromAddress: z.string().email(),
  type: z.enum(['SMTP_AUTH', 'SMTP_API', 'RESEND', 'MAILCHANNELS']),
  host: z.string().optional(),
  port: z.coerce.number().int().positive().optional(),
  secure: z.boolean().optional(),
  ignoreTLS: z.boolean().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  service: z.string().optional(),
  apiKey: z.string().optional(),
  apiKeyUser: z.string().optional(),
  endpoint: z.string().optional(),
});

export type EmailTransportFormValues = z.infer<typeof ZEmailTransportFormSchema>;

type EmailTransportFormProps = {
  defaultValues?: Partial<EmailTransportFormValues>;
  isEdit?: boolean;
  onFormSubmit: (values: EmailTransportFormValues) => Promise<void>;
  formSubmitTrigger?: React.ReactNode;
};

export const EmailTransportForm = ({
  defaultValues,
  isEdit = false,
  onFormSubmit,
  formSubmitTrigger,
}: EmailTransportFormProps) => {
  const { t } = useLingui();

  const form = useForm<EmailTransportFormValues>({
    resolver: zodResolver(ZEmailTransportFormSchema),
    defaultValues: {
      name: '',
      fromName: '',
      fromAddress: '',
      type: 'SMTP_AUTH',
      secure: false,
      ignoreTLS: false,
      ...defaultValues,
    },
  });

  const type = form.watch('type');
  const secretPlaceholder = isEdit ? t`Leave blank to keep current` : undefined;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onFormSubmit)}>
        <fieldset disabled={form.formState.isSubmitting} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Name</Trans>
                </FormLabel>
                <FormControl>
                  <Input placeholder={t`e.g. Resend (free plans)`} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="fromName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>From name</Trans>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fromAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>From address</Trans>
                  </FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Transport type</Trans>
                </FormLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={isEdit}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="SMTP_AUTH">SMTP (auth)</SelectItem>
                    <SelectItem value="SMTP_API">SMTP (api)</SelectItem>
                    <SelectItem value="RESEND">Resend</SelectItem>
                    <SelectItem value="MAILCHANNELS">MailChannels</SelectItem>
                  </SelectContent>
                </Select>
                {isEdit && (
                  <FormDescription>
                    <Trans>Transport type cannot be changed after creation.</Trans>
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          {(type === 'SMTP_AUTH' || type === 'SMTP_API') && (
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="host"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Host</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="port"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Port</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input type="number" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {type === 'SMTP_AUTH' && (
            <>
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Username</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Password</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input type="password" placeholder={secretPlaceholder} {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {type === 'SMTP_API' && (
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>API key</Trans>
                  </FormLabel>
                  <FormControl>
                    <Input type="password" placeholder={secretPlaceholder} {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {(type === 'RESEND' || type === 'MAILCHANNELS') && (
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>API key</Trans>
                  </FormLabel>
                  <FormControl>
                    <Input type="password" placeholder={secretPlaceholder} {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {type === 'MAILCHANNELS' && (
            <FormField
              control={form.control}
              name="endpoint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Endpoint (optional)</Trans>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {formSubmitTrigger}
        </fieldset>
      </form>
    </Form>
  );
};

/**
 * Maps flat form values to the tRPC `config` discriminated union.
 */
export const emailTransportFormToConfig = (values: EmailTransportFormValues) => {
  switch (values.type) {
    case 'SMTP_AUTH':
      return {
        type: 'SMTP_AUTH' as const,
        host: values.host ?? '',
        port: values.port ?? 587,
        secure: values.secure ?? false,
        ignoreTLS: values.ignoreTLS ?? false,
        username: values.username || undefined,
        password: values.password || undefined,
        service: values.service || undefined,
      };
    case 'SMTP_API':
      return {
        type: 'SMTP_API' as const,
        host: values.host ?? '',
        port: values.port ?? 587,
        secure: values.secure ?? false,
        apiKey: values.apiKey || '',
        apiKeyUser: values.apiKeyUser || undefined,
      };
    case 'RESEND':
      return { type: 'RESEND' as const, apiKey: values.apiKey || '' };
    case 'MAILCHANNELS':
      return {
        type: 'MAILCHANNELS' as const,
        apiKey: values.apiKey || '',
        endpoint: values.endpoint || undefined,
      };
  }
};
