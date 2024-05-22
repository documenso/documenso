'use client';

import { forwardRef, useEffect, useState } from 'react';

import { useParams } from 'next/navigation';
import { usePathname } from 'next/navigation';

import { z } from 'zod';

import { FieldType } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { useToast } from '@documenso/ui/primitives/use-toast';

import type { FieldFormType } from './add-fields';
import {
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerHeader,
} from './document-flow-root';
import { FieldItem } from './field-item';
import { CheckboxFieldAdvancedSettings } from './field-items-advanced-settings/checkbox-field';
import { DropdownFieldAdvancedSettings } from './field-items-advanced-settings/dropdown-field';
import { NumberFieldAdvancedSettings } from './field-items-advanced-settings/number-field';
import { RadioFieldAdvancedSettings } from './field-items-advanced-settings/radio-field';
import { TextFieldAdvancedSettings } from './field-items-advanced-settings/text-field';

export type FieldAdvancedSettingsProps = {
  title: string;
  description: string;
  field: FieldFormType;
  fields: FieldFormType[];
  onAdvancedSettings?: () => void;
  isDocumentPdfLoaded?: boolean;
  onSave?: (fieldState: FieldMeta) => void;
};

export type FieldMeta = {
  label?: string;
  placeholder?: string;
  format?: string;
  textField?: {
    addText: string;
  };
  numberField?: {
    value: number;
  };
  characterLimit?: number;
  required?: boolean;
  readOnly?: boolean;
};

const defaultConfigSchema = z.object({
  label: z.string(),
  placeholder: z.string(),
  format: z.string(),
  characterLimit: z.number(),
  required: z.boolean(),
  readOnly: z.boolean(),
});

export const FieldAdvancedSettings = forwardRef<HTMLDivElement, FieldAdvancedSettingsProps>(
  (
    { title, description, field, fields, onAdvancedSettings, isDocumentPdfLoaded = true, onSave },
    ref,
  ) => {
    const { toast } = useToast();
    const params = useParams();
    const pathname = usePathname();
    const id = params?.id;
    const isTemplatePage = pathname?.includes('template');
    const isDocumentPage = pathname?.includes('document');

    const { data: template } = trpc.template.getTemplateWithDetailsById.useQuery(
      {
        id: Number(id),
      },
      {
        enabled: isTemplatePage,
      },
    );

    const { data: document } = trpc.document.getDocumentById.useQuery(
      {
        id: Number(id),
      },
      {
        enabled: isDocumentPage,
      },
    );

    const doesFieldExist = (!!document || !!template) && field.nativeId !== undefined;

    const { data: fieldData } = trpc.field.getField.useQuery(
      {
        fieldId: Number(field.nativeId),
        documentId: document?.id ?? undefined,
        templateId: template?.id ?? undefined,
      },
      {
        enabled: doesFieldExist,
      },
    );

    const fieldMeta = fieldData?.fieldMeta;

    const localStorageKey = `field_${field.formId}_${field.type}`;

    const defaultState: FieldMeta = {
      label: '',
      placeholder: '',
      format: '',
      characterLimit: 0,
      required: false,
      readOnly: false,
    };

    useEffect(() => {
      if (
        fieldMeta &&
        typeof fieldMeta === 'object' &&
        'label' in fieldMeta &&
        'placeholder' in fieldMeta &&
        'format' in fieldMeta &&
        'characterLimit' in fieldMeta &&
        'required' in fieldMeta &&
        'readOnly' in fieldMeta
      ) {
        setFieldState({
          label: String(fieldMeta.label ?? ''),
          placeholder: String(fieldMeta.placeholder ?? ''),
          format: String(fieldMeta.format ?? ''),
          characterLimit: Number(fieldMeta.characterLimit ?? 0),
          required: Boolean(fieldMeta.required ?? false),
          readOnly: Boolean(fieldMeta.readOnly ?? false),
        });
      }
    }, [fieldMeta]);

    const [fieldState, setFieldState] = useState<FieldMeta>(() => {
      const savedState = localStorage.getItem(localStorageKey);
      return savedState ? { ...defaultState, ...JSON.parse(savedState) } : defaultState;
    });

    const handleFieldChange = (key: keyof FieldMeta, value: string) => {
      setFieldState((prevState: FieldMeta) => {
        if (key === 'characterLimit') {
          const parsedValue = Number(value);

          return {
            ...prevState,
            [key]: isNaN(parsedValue) ? undefined : parsedValue,
          };
        } else {
          return {
            ...prevState,
            [key]: value,
          };
        }
      });
    };

    const handleToggleChange = (key: keyof FieldMeta) => {
      setFieldState((prevState: FieldMeta) => ({
        ...prevState,
        [key]: !prevState[key],
      }));
    };

    const numberField = field.type === FieldType.NUMBER;
    const checkBoxField = field.type === FieldType.CHECKBOX;
    const radioField = field.type === FieldType.RADIO;
    const textField = field.type === FieldType.TEXT;
    const dropdownField = field.type === FieldType.DROPDOWN;

    const handleOnGoNextClick = () => {
      const validation = defaultConfigSchema.safeParse(fieldState);

      if (!validation.success) {
        toast({
          title: 'Error',
          description: 'An error occurred while saving the field.',
          variant: 'destructive',
        });

        return;
      } else {
        try {
          localStorage.setItem(localStorageKey, JSON.stringify(fieldState));

          onSave?.(fieldState);
          onAdvancedSettings?.();
        } catch (error) {
          console.error('Failed to save to localStorage:', error);

          toast({
            title: 'Error',
            description: 'Failed to save settings.',
            variant: 'destructive',
          });
        }
      }
    };

    return (
      <div ref={ref} className="flex h-full flex-col">
        <DocumentFlowFormContainerHeader title={title} description={description} />
        <DocumentFlowFormContainerContent>
          {isDocumentPdfLoaded &&
            fields.map((field, index) => (
              <span key={index} className="opacity-75 active:pointer-events-none">
                <FieldItem key={index} field={field} disabled={true} color={'gray-500'} />
              </span>
            ))}

          {textField && (
            <TextFieldAdvancedSettings
              fieldState={fieldState}
              handleFieldChange={handleFieldChange}
              handleToggleChange={handleToggleChange}
            />
          )}

          {numberField && (
            <NumberFieldAdvancedSettings
              fieldState={fieldState}
              handleFieldChange={handleFieldChange}
              handleToggleChange={handleToggleChange}
            />
          )}

          {radioField && (
            <RadioFieldAdvancedSettings
              fieldState={fieldState}
              handleFieldChange={handleFieldChange}
              handleToggleChange={handleToggleChange}
            />
          )}

          {checkBoxField && (
            <CheckboxFieldAdvancedSettings
              fieldState={fieldState}
              handleFieldChange={handleFieldChange}
              handleToggleChange={handleToggleChange}
            />
          )}

          {dropdownField && (
            <DropdownFieldAdvancedSettings
              fieldState={fieldState}
              handleFieldChange={handleFieldChange}
              handleToggleChange={handleToggleChange}
            />
          )}

          {/* add the rest */}
        </DocumentFlowFormContainerContent>
        <DocumentFlowFormContainerFooter className="mt-auto">
          <DocumentFlowFormContainerActions
            goNextLabel="Save"
            goBackLabel="Cancel"
            onGoBackClick={onAdvancedSettings}
            onGoNextClick={handleOnGoNextClick}
          />
        </DocumentFlowFormContainerFooter>
      </div>
    );
  },
);

FieldAdvancedSettings.displayName = 'FieldAdvancedSettings';
