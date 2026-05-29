import { forwardRef, useEffect, useState } from 'react';

import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { FieldType } from '@prisma/client';
import { GripVerticalIcon, Maximize2Icon, Minimize2Icon, XIcon } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Rnd } from 'react-rnd';
import { match } from 'ts-pattern';

import { useAutoSave } from '@documenso/lib/client-only/hooks/use-autosave';
import {
  type TBaseFieldMeta as BaseFieldMeta,
  type TCheckboxFieldMeta as CheckboxFieldMeta,
  type TDateFieldMeta as DateFieldMeta,
  type TDropdownFieldMeta as DropdownFieldMeta,
  type TEmailFieldMeta as EmailFieldMeta,
  type TFieldMetaSchema as FieldMeta,
  type TInitialsFieldMeta as InitialsFieldMeta,
  type TNameFieldMeta as NameFieldMeta,
  type TNumberFieldMeta as NumberFieldMeta,
  type TRadioFieldMeta as RadioFieldMeta,
  type TTextFieldMeta as TextFieldMeta,
  ZFieldMetaSchema,
} from '@documenso/lib/types/field-meta';
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
import { DateFieldAdvancedSettings } from './field-items-advanced-settings/date-field';
import { DropdownFieldAdvancedSettings } from './field-items-advanced-settings/dropdown-field';
import { EmailFieldAdvancedSettings } from './field-items-advanced-settings/email-field';
import { InitialsFieldAdvancedSettings } from './field-items-advanced-settings/initials-field';
import { NameFieldAdvancedSettings } from './field-items-advanced-settings/name-field';
import { NumberFieldAdvancedSettings } from './field-items-advanced-settings/number-field';
import { RadioFieldAdvancedSettings } from './field-items-advanced-settings/radio-field';
import { SignatureFieldAdvancedSettings } from './field-items-advanced-settings/signature-field';
import { TextFieldAdvancedSettings } from './field-items-advanced-settings/text-field';

export type FieldAdvancedSettingsProps = {
  title: MessageDescriptor;
  description: MessageDescriptor;
  field: FieldFormType;
  fields: FieldFormType[];
  onAdvancedSettings?: () => void;
  isDocumentPdfLoaded?: boolean;
  onSave?: (fieldState: FieldMeta) => void;
  onAutoSave?: (fieldState: FieldMeta) => Promise<void>;
  /**
   * Renders the editor as a draggable, collapsible floating panel instead of a
   * sidebar-replacing view, so the document and its fields stay visible while a
   * field's properties are edited.
   */
  floating?: boolean;
  /**
   * Called when the floating panel is dismissed via its close button. Defaults
   * to `onAdvancedSettings` when not provided.
   */
  onClose?: () => void;
  /**
   * Fired immediately on every property change (not debounced) so the parent can
   * reflect changes on the document in real time, independent of the remote
   * auto-save.
   */
  onFieldMetaChange?: (fieldState: FieldMeta) => void;
};

export type FieldMetaKeys =
  | keyof BaseFieldMeta
  | keyof TextFieldMeta
  | keyof NumberFieldMeta
  | keyof RadioFieldMeta
  | keyof CheckboxFieldMeta
  | keyof DropdownFieldMeta
  | keyof InitialsFieldMeta
  | keyof NameFieldMeta
  | keyof EmailFieldMeta
  | keyof DateFieldMeta;

const getDefaultState = (fieldType: FieldType): FieldMeta => {
  switch (fieldType) {
    case FieldType.SIGNATURE:
      return {
        type: 'signature',
        showLine: false,
      };
    case FieldType.INITIALS:
      return {
        type: 'initials',
        fontSize: 14,
        textAlign: 'left',
      };
    case FieldType.NAME:
      return {
        type: 'name',
        fontSize: 14,
        textAlign: 'left',
      };
    case FieldType.EMAIL:
      return {
        type: 'email',
        fontSize: 14,
        textAlign: 'left',
      };
    case FieldType.DATE:
      return {
        type: 'date',
        fontSize: 14,
        textAlign: 'left',
      };
    case FieldType.TEXT:
      return {
        type: 'text',
        label: '',
        placeholder: '',
        text: '',
        characterLimit: 0,
        fontSize: 14,
        required: false,
        readOnly: false,
        textAlign: 'left',
      };
    case FieldType.NUMBER:
      return {
        type: 'number',
        label: '',
        placeholder: '',
        numberFormat: '',
        value: '0',
        minValue: 0,
        maxValue: 0,
        required: false,
        readOnly: false,
        fontSize: 14,
        textAlign: 'left',
      };
    case FieldType.RADIO:
      return {
        type: 'radio',
        values: [],
        required: false,
        readOnly: false,
        direction: 'vertical',
      };
    case FieldType.CHECKBOX:
      return {
        type: 'checkbox',
        values: [],
        validationRule: '',
        validationLength: 0,
        required: false,
        readOnly: false,
        direction: 'vertical',
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

const PANEL_WIDTH = 360;

const getDefaultPanelPosition = () => {
  if (typeof window === 'undefined') {
    return { x: 24, y: 112 };
  }

  // Default to the top-right of the viewport so the panel sits clear of the
  // document area on the left while staying easy to reach.
  return {
    x: Math.max(24, window.innerWidth - PANEL_WIDTH - 32),
    y: 112,
  };
};

export const FieldAdvancedSettings = forwardRef<HTMLDivElement, FieldAdvancedSettingsProps>(
  (
    {
      title,
      description,
      field,
      fields,
      onAdvancedSettings,
      isDocumentPdfLoaded = true,
      onSave,
      onAutoSave,
      floating = false,
      onClose,
      onFieldMetaChange,
    },
    ref,
  ) => {
    const { _ } = useLingui();
    const { toast } = useToast();

    const [errors, setErrors] = useState<string[]>([]);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [defaultPanelPosition] = useState(getDefaultPanelPosition);

    const fieldMeta = field?.fieldMeta;

    const localStorageKey = `field_${field.formId}_${field.type}`;

    const defaultState: FieldMeta = getDefaultState(field.type);

    const [fieldState, setFieldState] = useState(() => {
      const savedState = localStorage.getItem(localStorageKey);
      return savedState ? { ...defaultState, ...JSON.parse(savedState) } : defaultState;
    });

    useEffect(() => {
      if (fieldMeta && typeof fieldMeta === 'object') {
        const parsedFieldMeta = ZFieldMetaSchema.parse(fieldMeta);

        setFieldState({
          ...defaultState,
          ...parsedFieldMeta,
        });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fieldMeta]);

    const { scheduleSave } = useAutoSave(onAutoSave || (async () => {}));

    const handleAutoSave = () => {
      if (errors.length === 0) {
        scheduleSave(fieldState);
      }
    };

    // Auto-save to localStorage and schedule remote save when fieldState changes
    useEffect(() => {
      try {
        localStorage.setItem(localStorageKey, JSON.stringify(fieldState));
        handleAutoSave();
      } catch (error) {
        console.error('Failed to save to localStorage:', error);
      }
    }, [fieldState, localStorageKey, handleAutoSave]);

    // Reflect property changes on the document immediately (the remote save is
    // debounced, but the preview should not lag behind the user's input).
    useEffect(() => {
      if (errors.length === 0) {
        onFieldMetaChange?.(fieldState);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fieldState]);

    const handleFieldChange = (
      key: FieldMetaKeys,
      value:
        | string
        | { checked: boolean; value: string }[]
        | { value: string }[]
        | boolean
        | number,
    ) => {
      setFieldState((prevState: FieldMeta) => {
        if (
          ['characterLimit', 'minValue', 'maxValue', 'validationLength', 'fontSize'].includes(key)
        ) {
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

    const handleOnGoNextClick = () => {
      try {
        if (errors.length > 0) {
          return;
        } else {
          localStorage.setItem(localStorageKey, JSON.stringify(fieldState));

          onSave?.(fieldState);
          onAdvancedSettings?.();
        }
      } catch (error) {
        console.error('Failed to save to localStorage:', error);

        toast({
          title: _(msg`Error`),
          description: _(msg`Failed to save settings.`),
          variant: 'destructive',
        });
      }
    };

    const handleClose = onClose ?? onAdvancedSettings;

    const fieldSettingsForm = match(field.type)
      .with(FieldType.SIGNATURE, () => (
        <SignatureFieldAdvancedSettings
          fieldState={fieldState}
          handleFieldChange={handleFieldChange}
          handleErrors={setErrors}
        />
      ))
      .with(FieldType.INITIALS, () => (
        <InitialsFieldAdvancedSettings
          fieldState={fieldState}
          handleFieldChange={handleFieldChange}
          handleErrors={setErrors}
        />
      ))
      .with(FieldType.NAME, () => (
        <NameFieldAdvancedSettings
          fieldState={fieldState}
          handleFieldChange={handleFieldChange}
          handleErrors={setErrors}
        />
      ))
      .with(FieldType.EMAIL, () => (
        <EmailFieldAdvancedSettings
          fieldState={fieldState}
          handleFieldChange={handleFieldChange}
          handleErrors={setErrors}
        />
      ))
      .with(FieldType.DATE, () => (
        <DateFieldAdvancedSettings
          fieldState={fieldState}
          handleFieldChange={handleFieldChange}
          handleErrors={setErrors}
        />
      ))
      .with(FieldType.TEXT, () => (
        <TextFieldAdvancedSettings
          fieldState={fieldState}
          handleFieldChange={handleFieldChange}
          handleErrors={setErrors}
        />
      ))
      .with(FieldType.NUMBER, () => (
        <NumberFieldAdvancedSettings
          fieldState={fieldState}
          handleFieldChange={handleFieldChange}
          handleErrors={setErrors}
        />
      ))
      .with(FieldType.RADIO, () => (
        <RadioFieldAdvancedSettings
          fieldState={fieldState}
          handleFieldChange={handleFieldChange}
          handleErrors={setErrors}
        />
      ))
      .with(FieldType.CHECKBOX, () => (
        <CheckboxFieldAdvancedSettings
          fieldState={fieldState}
          handleFieldChange={handleFieldChange}
          handleErrors={setErrors}
        />
      ))
      .with(FieldType.DROPDOWN, () => (
        <DropdownFieldAdvancedSettings
          fieldState={fieldState}
          handleFieldChange={handleFieldChange}
          handleErrors={setErrors}
        />
      ))
      .otherwise(() => null);

    const errorList = errors.length > 0 && (
      <div className="mt-4">
        <ul>
          {errors.map((error, index) => (
            <li className="text-sm text-red-500" key={index}>
              {error}
            </li>
          ))}
        </ul>
      </div>
    );

    const footerActions = (
      <DocumentFlowFormContainerActions
        goNextLabel={msg`Save`}
        goBackLabel={msg`Cancel`}
        onGoBackClick={onAdvancedSettings}
        onGoNextClick={handleOnGoNextClick}
        disableNextStep={errors.length > 0}
      />
    );

    // Floating, draggable, collapsible panel. Renders over the editor without
    // replacing the field-placement sidebar, so the document and the fields on
    // it remain visible (and editable) while properties are tweaked.
    if (floating) {
      return createPortal(
        <div className="pointer-events-none fixed inset-0 z-[60]">
          <Rnd
            default={{ ...defaultPanelPosition, width: PANEL_WIDTH, height: 'auto' }}
            bounds="parent"
            dragHandleClassName="field-advanced-settings-drag-handle"
            enableResizing={false}
            className="pointer-events-auto"
          >
            <div
              ref={ref}
              data-testid="field-advanced-settings-panel"
              style={{ width: PANEL_WIDTH }}
              className="flex max-h-[80vh] flex-col overflow-hidden rounded-xl border border-border bg-widget shadow-2xl dark:bg-background"
            >
              <div className="field-advanced-settings-drag-handle flex cursor-move items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <GripVerticalIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-semibold text-foreground">{_(title)}</span>
                </div>

                <div className="flex flex-shrink-0 items-center gap-1">
                  <button
                    type="button"
                    title={isCollapsed ? _(msg`Expand`) : _(msg`Minimize`)}
                    aria-label={isCollapsed ? _(msg`Expand`) : _(msg`Minimize`)}
                    data-testid="field-advanced-settings-collapse"
                    className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                    onClick={() => setIsCollapsed((prev) => !prev)}
                  >
                    {isCollapsed ? (
                      <Maximize2Icon className="h-4 w-4" />
                    ) : (
                      <Minimize2Icon className="h-4 w-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    title={_(msg`Close`)}
                    aria-label={_(msg`Close`)}
                    data-testid="field-advanced-settings-close"
                    className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                    onClick={handleClose}
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {!isCollapsed && (
                <>
                  <div className="custom-scrollbar flex-1 overflow-y-auto px-4 py-4">
                    <p className="mb-4 text-sm text-muted-foreground">{_(description)}</p>

                    {fieldSettingsForm}

                    {errorList}
                  </div>

                  <DocumentFlowFormContainerFooter
                    className="m-0 flex-shrink-0 border-t border-border px-4 py-3"
                    data-testid="field-advanced-settings-footer"
                  >
                    {footerActions}
                  </DocumentFlowFormContainerFooter>
                </>
              )}
            </div>
          </Rnd>
        </div>,
        document.body,
      );
    }

    return (
      <div ref={ref} className="flex h-full flex-col">
        <DocumentFlowFormContainerHeader title={title} description={description} />

        <DocumentFlowFormContainerContent>
          {isDocumentPdfLoaded &&
            fields.map((localField, index) => (
              <span key={index} className="opacity-75 active:pointer-events-none">
                <FieldItem
                  key={index}
                  field={localField}
                  disabled={true}
                  fieldClassName={
                    localField.formId === field.formId ? 'ring-red-400' : 'ring-neutral-200'
                  }
                />
              </span>
            ))}

          {fieldSettingsForm}

          {errorList}
        </DocumentFlowFormContainerContent>

        <DocumentFlowFormContainerFooter
          className="mt-auto"
          data-testid="field-advanced-settings-footer"
        >
          {footerActions}
        </DocumentFlowFormContainerFooter>
      </div>
    );
  },
);

FieldAdvancedSettings.displayName = 'FieldAdvancedSettings';
