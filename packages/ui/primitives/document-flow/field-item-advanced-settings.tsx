import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { trpc } from '@documenso/trpc/react';

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../form/form';
import { Input } from '../input';
import type { FieldFormType } from './add-fields';
import {
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerHeader,
} from './document-flow-root';
import { FieldItem } from './field-item';
import type { TNumberAdvancedSettingsFormSchema } from './field-item-advanced-settings.types';
import { ZNumberAdvancedSettingsFormSchema } from './field-item-advanced-settings.types';

export type FieldAdvancedSettingsProps = {
  title: string;
  description: string;
  field: FieldFormType;
  fields: FieldFormType[];
  onAdvancedSettings?: () => void;
  isDocumentPdfLoaded: boolean;
};

export const FieldAdvancedSettings = ({
  title,
  description,
  field,
  fields,
  onAdvancedSettings,
  isDocumentPdfLoaded,
}: FieldAdvancedSettingsProps) => {
  const { data } = trpc.field.getField.useQuery({
    fieldId: field.nativeId || 0,
    documentId: 8,
  });

  const form = useForm<TNumberAdvancedSettingsFormSchema>({
    resolver: zodResolver(ZNumberAdvancedSettingsFormSchema),
  });

  const onSubmit = form.handleSubmit((data) => {
    try {
      console.log(data);
      onAdvancedSettings?.();
    } catch (err) {
      console.error(err);
    }
  });

  return (
    <>
      <DocumentFlowFormContainerHeader title={title} description={description} />
      <DocumentFlowFormContainerContent>
        <div className="flex flex-col">
          {isDocumentPdfLoaded &&
            fields.map((field, index) => (
              <span key={index} className="opacity-75 active:pointer-events-none">
                <FieldItem key={index} field={field} disabled={true} />
              </span>
            ))}

          <Form {...form}>
            <div className="flex flex-col gap-y-4">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="label">Label</FormLabel>
                    <FormControl>
                      <Input
                        id="label"
                        className="bg-background mt-2"
                        disabled={form.formState.isSubmitting}
                        placeholder="Field label"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="placeholder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="placeholder">Placeholder</FormLabel>
                    <FormControl>
                      <Input
                        id="placeholder"
                        className="bg-background mt-2"
                        disabled={form.formState.isSubmitting}
                        placeholder="Field placeholder"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="format"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="format">Format</FormLabel>
                    <FormControl>
                      <Input
                        id="format"
                        className="bg-background mt-2"
                        disabled={form.formState.isSubmitting}
                        placeholder="Field format"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="characterLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="characterLimit">Character Limit</FormLabel>
                    <FormControl>
                      <Input
                        id="characterLimit"
                        className="bg-background mt-2"
                        disabled={form.formState.isSubmitting}
                        placeholder="Field character limit"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Form>
        </div>
      </DocumentFlowFormContainerContent>
      <DocumentFlowFormContainerFooter>
        <DocumentFlowFormContainerActions
          goNextLabel="Save"
          goBackLabel="Cancel"
          onGoBackClick={onAdvancedSettings}
          onGoNextClick={() => {
            void onSubmit();
          }}
        />
      </DocumentFlowFormContainerFooter>
    </>
  );
};
