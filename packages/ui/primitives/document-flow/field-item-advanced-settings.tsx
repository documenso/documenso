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

type BaseFieldMeta = {
  label?: string;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
};

export type TextFieldMeta = BaseFieldMeta & {
  type: 'text';
  text?: string;
  characterLimit?: number;
};

export type NumberFieldMeta = BaseFieldMeta & {
  type: 'number';
  numberFormat?: string;
  value?: number;
  minValue?: number;
  maxValue?: number;
};

export type RadioFieldMeta = BaseFieldMeta & {
  type: 'radio';
  values?: {
    checked: boolean;
    value: string;
  }[];
};

export type CheckboxFieldMeta = BaseFieldMeta & {
  type: 'checkbox';
  values?: {
    checked: boolean;
    value: string;
  }[];
  validationRule?: string;
  validationLength?: number;
};

export type DropdownFieldMeta = BaseFieldMeta & {
  type: 'dropdown';
  values?: string[];
  defaultValue?: string;
};

export type FieldMeta =
  | TextFieldMeta
  | NumberFieldMeta
  | RadioFieldMeta
  | CheckboxFieldMeta
  | DropdownFieldMeta;

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

    const getDefaultState = (fieldType: FieldType): FieldMeta => {
      switch (fieldType) {
        case FieldType.TEXT:
          return {
            type: 'text',
            label: '',
            placeholder: '',
            text: '',
            characterLimit: 0,
            required: false,
            readOnly: false,
          };
        case FieldType.NUMBER:
          return {
            type: 'number',
            label: '',
            placeholder: '',
            numberFormat: '',
            value: 0,
            minValue: 0,
            maxValue: 0,
            required: false,
            readOnly: false,
          };
        case FieldType.RADIO:
          return {
            type: 'radio',
            values: [],
            required: false,
            readOnly: false,
          };
        case FieldType.CHECKBOX:
          return {
            type: 'checkbox',
            values: [],
            validationRule: '',
            validationLength: 0,
            required: false,
            readOnly: false,
          };
        case FieldType.DROPDOWN:
          return {
            type: 'dropdown',
            values: [],
            defaultValue: '',
            required: false,
            readOnly: false,
          };
        default:
          throw new Error(`Unsupported field type: ${fieldType}`);
      }
    };

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

    const defaultState: FieldMeta = getDefaultState(field.type);

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
          ...defaultState,
          ...fieldMeta,
        });
      }
    }, [fieldMeta]);

    const [fieldState, setFieldState] = useState<FieldMeta>(() => {
      const savedState = localStorage.getItem(localStorageKey);
      return savedState ? { ...defaultState, ...JSON.parse(savedState) } : defaultState;
    });

    console.log('fieldState', fieldState);

    const handleFieldChange = (key: keyof FieldMeta, value: string) => {
      setFieldState((prevState: FieldMeta) => {
        if (['characterLimit', 'minValue', 'maxValue', 'value', 'validationLength'].includes(key)) {
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
