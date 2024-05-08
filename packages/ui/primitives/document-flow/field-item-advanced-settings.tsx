'use client';

import { useParams } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { trpc } from '@documenso/trpc/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Switch } from '@documenso/ui/primitives/switch';

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

// TODO: Remove hardcoded values and refactor
const listValues = [
  {
    label: '123,456.78',
    value: '123,456.78',
  },
  {
    label: '123.456,78',
    value: '123.456,78',
  },
];

export const FieldAdvancedSettings = ({
  title,
  description,
  field,
  fields,
  onAdvancedSettings,
  isDocumentPdfLoaded,
}: FieldAdvancedSettingsProps) => {
  const params = useParams();
  const documentId = params.id;

  const { data } = trpc.field.getField.useQuery({
    fieldId: field.nativeId || 0,
    documentId: Number(documentId),
  });

  const { mutateAsync: updateRadioField } = trpc.field.updateRadioField.useMutation();

  const form = useForm<TNumberAdvancedSettingsFormSchema>({
    resolver: zodResolver(ZNumberAdvancedSettingsFormSchema),
    defaultValues: {
      // TODO: Fix this to get rid of the error "Property 'placeholder' does not exist on type 'string | number | boolean | JsonObject | JsonArray'"
      label: data?.fieldMeta?.label ?? '',
      placeholder: data?.fieldMeta?.placeholder ?? '',
      format: data?.fieldMeta?.format ?? '',
      characterLimit: data?.fieldMeta?.characterLimit ?? '',
      required: data?.fieldMeta?.required ?? false,
      readOnly: data?.fieldMeta?.readOnly ?? false,
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await updateRadioField({
        fieldId: field.nativeId || 0,
        documentId: Number(documentId),
        meta: data,
      });
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
                  <FormItem className="flex flex-col">
                    <FormLabel htmlFor="format">Format</FormLabel>
                    <FormControl>
                      <Select {...field} onValueChange={field.onChange}>
                        <SelectTrigger className="text-muted-foreground w-full">
                          <SelectValue placeholder="Field format" />
                        </SelectTrigger>

                        <SelectContent position="popper">
                          {listValues.map((item, index) => (
                            <SelectItem key={index} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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

              <div className="flex flex-row items-center gap-12">
                <FormField
                  control={form.control}
                  name="required"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2">
                      <FormLabel className="mt-2">Required field?</FormLabel>
                      <FormControl>
                        <Switch
                          className="bg-background"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="readOnly"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2">
                      <FormLabel className="mt-2">Read only?</FormLabel>
                      <FormControl>
                        <Switch
                          className="bg-background"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
