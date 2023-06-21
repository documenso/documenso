'use client';

import { Control, Controller, FieldErrors, UseFormWatch } from 'react-hook-form';

import { cn } from '@documenso/ui/lib/utils';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { Textarea } from '@documenso/ui/primitives/textarea';

import { FormErrorMessage } from '~/components/form/form-error-message';

import { TEditDocumentFormSchema } from './types';

export type AddSubjectFormProps = {
  className?: string;
  control: Control<TEditDocumentFormSchema>;
  watch: UseFormWatch<TEditDocumentFormSchema>;
  errors: FieldErrors<TEditDocumentFormSchema>;
  isSubmitting: boolean;
};

export const AddSubjectFormPartial = ({
  className,
  control,
  errors,
  isSubmitting,
}: AddSubjectFormProps) => {
  return (
    <div className={cn('flex flex-col', className)}>
      <h3 className="text-foreground text-2xl font-semibold">Add Subject</h3>

      <p className="text-muted-foreground mt-2 text-sm">
        Add the subject and message you wish to send to signers.
      </p>

      <hr className="border-border mb-8 mt-4" />

      <div className="flex flex-col gap-y-4">
        <div>
          <Label htmlFor="subject">
            Subject <span className="text-muted-foreground">(Optional)</span>
          </Label>

          <Controller
            control={control}
            name="email.subject"
            render={({ field }) => (
              <Input
                id="subject"
                // placeholder="Subject"
                className="bg-background mt-2"
                disabled={isSubmitting}
                {...field}
              />
            )}
          />

          <FormErrorMessage className="mt-2" errors={errors} />
        </div>

        <div>
          <Label htmlFor="message">
            Message <span className="text-muted-foreground">(Optional)</span>
          </Label>

          <Controller
            control={control}
            name="email.message"
            render={({ field }) => (
              <Textarea
                id="message"
                className="bg-background mt-2 h-32 resize-none"
                disabled={isSubmitting}
                {...field}
              />
            )}
          />

          <FormErrorMessage className="mt-2" errors={errors} />
        </div>

        <div>
          <p className="text-muted-foreground text-sm">
            You can use the following variables in your message:
          </p>

          <ul className="mt-2 flex list-inside list-disc flex-col gap-y-2 text-sm">
            <li className="text-muted-foreground">
              <code className="text-muted-foreground bg-muted-foreground/20 rounded p-1 text-sm">
                {'{signer.name}'}
              </code>{' '}
              - The signer's name
            </li>
            <li className="text-muted-foreground">
              <code className="text-muted-foreground bg-muted-foreground/20 rounded p-1 text-sm">
                {'{signer.email}'}
              </code>{' '}
              - The signer's email
            </li>
            <li className="text-muted-foreground">
              <code className="text-muted-foreground bg-muted-foreground/20 rounded p-1 text-sm">
                {'{document.name}'}
              </code>{' '}
              - The document's name
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
