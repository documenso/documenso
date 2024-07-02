'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Caveat } from 'next/font/google';

import {
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronsUpDown,
  Disc,
  Hash,
  Mail,
  Type,
  User,
} from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';

import { getBoundingClientRect } from '@documenso/lib/client-only/get-bounding-client-rect';
import { useDocumentElement } from '@documenso/lib/client-only/hooks/use-document-element';
import { useRecipientColorClasses } from '@documenso/lib/client-only/hooks/use-recipient-color-classes';
import { useSelectedSignerStyles } from '@documenso/lib/client-only/hooks/use-selected-signer-styles';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import { ZFieldMetaSchema } from '@documenso/lib/types/field-meta';
import { type TFieldMetaSchema as FieldMeta } from '@documenso/lib/types/field-meta';
import { nanoid } from '@documenso/lib/universal/id';
import type { Field, Recipient } from '@documenso/prisma/client';
import { FieldType, RecipientRole } from '@documenso/prisma/client';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@documenso/ui/primitives/command';
import {
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerHeader,
  DocumentFlowFormContainerStep,
} from '@documenso/ui/primitives/document-flow/document-flow-root';
import { FieldItem } from '@documenso/ui/primitives/document-flow/field-item';
import type { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import { FRIENDLY_FIELD_TYPE } from '@documenso/ui/primitives/document-flow/types';
import { Popover, PopoverContent, PopoverTrigger } from '@documenso/ui/primitives/popover';

import type { CombinedStylesKey, FieldFormType } from '../document-flow/add-fields';
import { FieldAdvancedSettings } from '../document-flow/field-item-advanced-settings';
import { useStep } from '../stepper';
import type { TAddTemplateFieldsFormSchema } from './add-template-fields.types';

const fontCaveat = Caveat({
  weight: ['500'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-caveat',
});

const DEFAULT_HEIGHT_PERCENT = 5;
const DEFAULT_WIDTH_PERCENT = 15;

const MIN_HEIGHT_PX = 60;
const MIN_WIDTH_PX = 200;

/*
  I hate this, but due to TailwindCSS JIT, I couldnn't find a better way to do this for now.

  TODO: Try to find a better way to do this.
*/
export const combinedStyles = {
  'orange-500': {
    ringColor:
      'border-orange-500 ring-orange-200/60 ring-offset-orange-200/60 dark:ring-orange-900/60 dark:ring-offset-orange-900/60',
    borderWithHover:
      'group-data-[selected]:border-orange-500 group-data-[selected]:bg-orange-500/20 hover:border-orange-500 hover:ring-2 hover:ring-orange-200 hover:ring-offset-2 hover:ring-offset-orange-200 dark:hover:ring-orange-900/60 dark:hover:ring-offset-orange-900/60 shadow-none group-data-[selected]:ring-2 group-data-[selected]:ring-orange-200 group-data-[selected]:ring-offset-2 group-data-[selected]:ring-offset-orange-200 dark:group-data-[selected]:ring-orange-900/60 dark:group-data-[selected]:ring-offset-orange-900/60',
    border: 'border-orange-500',
    borderActive: 'border-2 border-orange-500 bg-orange-500/20 shadow-none',
    borderActiveWithinBounds:
      'ring-2 ring-orange-200/60 ring-offset-2 ring-offset-orange-200/60 shadow-none',
    borderActiveOutsideBounds:
      'ring-2 ring-orange-200/60 ring-offset-2 ring-offset-orange-200/60 dark:ring-2 dark:ring-orange-900/60 dark:ring-offset-2 dark:ring-offset-orange-900/60 shadow-none',
    background: 'bg-orange-500/60 border-orange-500',
    initialsBG: 'bg-orange-500',
  },
  'green-500': {
    ringColor:
      'border-green-500 ring-green-200/60 ring-offset-green-200/60 dark:ring-green-900/60 dark:ring-offset-green-900/60',
    borderWithHover:
      'group-data-[selected]:border-green-500 group-data-[selected]:bg-green-500/20 hover:border-green-500 hover:ring-2 hover:ring-green-200 hover:ring-offset-2 hover:ring-offset-green-200 dark:hover:ring-green-900/60 dark:hover:ring-offset-green-900/60 shadow-none group-data-[selected]:ring-2 group-data-[selected]:ring-green-200 group-data-[selected]:ring-offset-2 group-data-[selected]:ring-offset-green-200 dark:group-data-[selected]:ring-green-900/60 dark:group-data-[selected]:ring-offset-green-900/60',
    border: 'border-green-500',
    borderActive: 'border-2 border-green-500 bg-green-500/20 shadow-none',
    borderActiveWithinBounds:
      'ring-2 ring-green-200/60 ring-offset-2 ring-offset-green-200/60 shadow-none',
    borderActiveOutsideBounds:
      'ring-2 ring-green-200/60 ring-offset-2 ring-offset-green-200/60 dark:ring-2 dark:ring-green-900/60 dark:ring-offset-2 dark:ring-offset-green-900/60 shadow-none',
    background: 'bg-green-500/60 border-green-500',
    initialsBG: 'bg-green-500',
  },
  'cyan-500': {
    ringColor:
      'border-cyan-500 ring-cyan-200/60 ring-offset-cyan-200/60 dark:ring-cyan-900/60 dark:ring-offset-cyan-900/60',
    borderWithHover:
      'group-data-[selected]:border-cyan-500 group-data-[selected]:bg-cyan-500/20 hover:border-cyan-500 hover:ring-2 hover:ring-cyan-200 hover:ring-offset-2 hover:ring-offset-cyan-200 dark:hover:ring-cyan-900/60 dark:hover:ring-offset-cyan-900/60 shadow-none group-data-[selected]:ring-2 group-data-[selected]:ring-cyan-200 group-data-[selected]:ring-offset-2 group-data-[selected]:ring-offset-cyan-200 dark:group-data-[selected]:ring-cyan-900/60 dark:group-data-[selected]:ring-offset-cyan-900/60',
    border: 'border-cyan-500',
    borderActive: 'border-2 border-cyan-500 bg-cyan-500/20 shadow-none',
    borderActiveWithinBounds:
      'ring-2 ring-cyan-200/60 ring-offset-2 ring-offset-cyan-200/60 shadow-none',
    borderActiveOutsideBounds:
      'ring-2 ring-cyan-200/60 ring-offset-2 ring-offset-cyan-200/60 dark:ring-2 dark:ring-cyan-900/60 dark:ring-offset-2 dark:ring-offset-cyan-900/60 shadow-none',
    background: 'bg-cyan-500/60 border-cyan-500',
    initialsBG: 'bg-cyan-500',
  },
  'blue-500': {
    ringColor:
      'border-blue-500 ring-blue-200/60 ring-offset-blue-200/60 dark:ring-blue-900/60 dark:ring-offset-blue-900/60',
    borderWithHover:
      'group-data-[selected]:border-blue-500 group-data-[selected]:bg-blue-500/20 hover:border-blue-500 hover:ring-2 hover:ring-blue-200 hover:ring-offset-2 hover:ring-offset-blue-200 dark:hover:ring-blue-900/60 dark:hover:ring-offset-blue-900/60 shadow-none group-data-[selected]:ring-2 group-data-[selected]:ring-blue-200 group-data-[selected]:ring-offset-2 group-data-[selected]:ring-offset-blue-200 dark:group-data-[selected]:ring-blue-900/60 dark:group-data-[selected]:ring-offset-blue-900/60',
    border: 'border-blue-500',
    borderActive: 'border-2 border-blue-500 bg-blue-500/20 shadow-none',
    borderActiveWithinBounds:
      'ring-2 ring-blue-200/60 ring-offset-2 ring-offset-blue-200/60 shadow-none',
    borderActiveOutsideBounds:
      'ring-2 ring-blue-200/60 ring-offset-2 ring-offset-blue-200/60 dark:ring-2 dark:ring-blue-900/60 dark:ring-offset-2 dark:ring-offset-blue-900/60 shadow-none',
    background: 'bg-blue-500/60 border-blue-500',
    initialsBG: 'bg-blue-500',
  },
  'indigo-500': {
    ringColor:
      'border-indigo-500 ring-indigo-200/60 ring-offset-indigo-200/60 dark:ring-indigo-900/60 dark:ring-offset-indigo-900/60',
    borderWithHover:
      'group-data-[selected]:border-indigo-500 group-data-[selected]:bg-indigo-500/20 hover:border-indigo-500 hover:ring-2 hover:ring-indigo-200 hover:ring-offset-2 hover:ring-offset-indigo-200 dark:hover:ring-indigo-900/60 dark:hover:ring-offset-indigo-900/60 shadow-none group-data-[selected]:ring-2 group-data-[selected]:ring-indigo-200 group-data-[selected]:ring-offset-2 group-data-[selected]:ring-offset-indigo-200 dark:group-data-[selected]:ring-indigo-900/60 dark:group-data-[selected]:ring-offset-indigo-900/60',
    border: 'border-indigo-500',
    borderActive: 'border-2 border-indigo-500 bg-indigo-500/20 shadow-none',
    borderActiveWithinBounds:
      'ring-2 ring-indigo-200/60 ring-offset-2 ring-offset-indigo-200/60 shadow-none',
    borderActiveOutsideBounds:
      'ring-2 ring-indigo-200/60 ring-offset-2 ring-offset-indigo-200/60 dark:ring-2 dark:ring-indigo-900/60 dark:ring-offset-2 dark:ring-offset-indigo-900/60 shadow-none',
    background: 'bg-indigo-500/60 border-indigo-500',
    initialsBG: 'bg-indigo-500',
  },
  'purple-500': {
    ringColor:
      'border-purple-500 ring-purple-200/60 ring-offset-purple-200/60 dark:ring-purple-900/60 dark:ring-offset-purple-900/60',
    borderWithHover:
      'group-data-[selected]:border-purple-500 group-data-[selected]:bg-purple-500/20 hover:border-purple-500 hover:ring-2 hover:ring-purple-200 hover:ring-offset-2 hover:ring-offset-purple-200 dark:hover:ring-purple-900/60 dark:hover:ring-offset-purple-900/60 shadow-none group-data-[selected]:ring-2 group-data-[selected]:ring-purple-200 group-data-[selected]:ring-offset-2 group-data-[selected]:ring-offset-purple-200 dark:group-data-[selected]:ring-purple-900/60 dark:group-data-[selected]:ring-offset-purple-900/60',
    border: 'border-purple-500',
    borderActive: 'border-2 border-purple-500 bg-purple-500/20 shadow-none',
    borderActiveWithinBounds:
      'ring-2 ring-purple-200/60 ring-offset-2 ring-offset-purple-200/60 shadow-none',
    borderActiveOutsideBounds:
      'ring-2 ring-purple-200/60 ring-offset-2 ring-offset-purple-200/60 dark:ring-2 dark:ring-purple-900/60 dark:ring-offset-2 dark:ring-offset-purple-900/60 shadow-none',
    background: 'bg-purple-500/60 border-purple-500',
    initialsBG: 'bg-purple-500',
  },
  'pink-500': {
    ringColor:
      'border-pink-500 ring-pink-200/60 ring-offset-pink-200/60 dark:ring-pink-900/60 dark:ring-offset-pink-900/60',
    borderWithHover:
      'group-data-[selected]:border-pink-500 group-data-[selected]:bg-pink-500/20 hover:border-pink-500 hover:ring-2 hover:ring-pink-200 hover:ring-offset-2 hover:ring-offset-pink-200 dark:hover:ring-pink-900/60 dark:hover:ring-offset-pink-900/60 shadow-none group-data-[selected]:ring-2 group-data-[selected]:ring-pink-200 group-data-[selected]:ring-offset-2 group-data-[selected]:ring-offset-pink-200 dark:group-data-[selected]:ring-pink-900/60 dark:group-data-[selected]:ring-offset-pink-900/60',
    border: 'border-pink-500',
    borderActive: 'border-2 border-pink-500 bg-pink-500/20 shadow-none',
    borderActiveWithinBounds:
      'ring-2 ring-pink-200/60 ring-offset-2 ring-offset-pink-200/60 shadow-none',
    borderActiveOutsideBounds:
      'ring-2 ring-pink-200/60 ring-offset-2 ring-offset-pink-200/60 dark:ring-2 dark:ring-pink-900/60 dark:ring-offset-2 dark:ring-offset-pink-900/60 shadow-none',
    background: 'bg-pink-500/60 border-pink-500',
    initialsBG: 'bg-pink-500',
  },
  'gray-500': {
    ringColor:
      'border-gray-500 ring-gray-200/60 ring-offset-gray-200/60 dark:ring-gray-900/60 dark:ring-offset-gray-900/60',
    borderWithHover:
      'group-data-[selected]:border-gray-500 group-data-[selected]:bg-gray-500/20 hover:border-gray-500 hover:ring-2 hover:ring-gray-200 hover:ring-offset-2 hover:ring-offset-gray-200 dark:hover:ring-gray-900/60 dark:hover:ring-offset-gray-900/60 shadow-none group-data-[selected]:ring-2 group-data-[selected]:ring-gray-200 group-data-[selected]:ring-offset-2 group-data-[selected]:ring-offset-gray-200 dark:group-data-[selected]:ring-gray-900/60 dark:group-data-[selected]:ring-offset-gray-900/60',
    border: 'border-gray-500',
    borderActive: 'border-2 border-gray-500 bg-gray-500/20 shadow-none',
    borderActiveWithinBounds:
      'ring-2 ring-gray-200/60 ring-offset-2 ring-offset-gray-200/60 shadow-none',
    borderActiveOutsideBounds:
      'ring-2 ring-gray-200/60 ring-offset-2 ring-offset-gray-200/60 dark:ring-2 dark:ring-gray-900/60 dark:ring-offset-2 dark:ring-offset-gray-900/60 shadow-none',
    background: 'bg-gray-500/60 border-gray-500',
    initialsBG: 'bg-gray-500',
    fieldBackground: 'bg-gray-500/[.025]',
  },
};

export const colorClasses: CombinedStylesKey[] = [
  'orange-500',
  'green-500',
  'cyan-500',
  'blue-500',
  'indigo-500',
  'purple-500',
  'pink-500',
];

export type AddTemplateFieldsFormProps = {
  documentFlow: DocumentFlowStep;
  hideRecipients?: boolean;
  recipients: Recipient[];
  fields: Field[];
  onSubmit: (_data: TAddTemplateFieldsFormSchema) => void;
  teamId?: number;
};

export const AddTemplateFieldsFormPartial = ({
  documentFlow,
  hideRecipients = false,
  recipients,
  fields,
  onSubmit,
  teamId,
}: AddTemplateFieldsFormProps) => {
  const { isWithinPageBounds, getFieldPosition, getPage } = useDocumentElement();
  const { currentStep, totalSteps, previousStep } = useStep();
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [currentField, setCurrentField] = useState<FieldFormType>();
  const recipientColorClasses = useRecipientColorClasses(recipients, colorClasses);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
    setValue,
    getValues,
  } = useForm<TAddTemplateFieldsFormSchema>({
    defaultValues: {
      fields: fields.map((field) => ({
        nativeId: field.id,
        formId: `${field.id}-${field.templateId}`,
        pageNumber: field.page,
        type: field.type,
        pageX: Number(field.positionX),
        pageY: Number(field.positionY),
        pageWidth: Number(field.width),
        pageHeight: Number(field.height),
        signerId: field.recipientId ?? -1,
        signerEmail:
          recipients.find((recipient) => recipient.id === field.recipientId)?.email ?? '',
        signerToken:
          recipients.find((recipient) => recipient.id === field.recipientId)?.token ?? '',
      })),
    },
  });

  const onFormSubmit = handleSubmit(onSubmit);

  const handleSavedFieldSettings = (fieldState: FieldMeta) => {
    const initialValues = getValues();

    const updatedFields = initialValues.fields.map((field) => {
      if (field.formId === currentField?.formId) {
        const parsedFieldMeta = ZFieldMetaSchema.parse(fieldState);

        return {
          ...field,
          fieldMeta: parsedFieldMeta,
        };
      }

      return field;
    });

    setValue('fields', updatedFields);
  };

  const {
    append,
    remove,
    update,
    fields: localFields,
  } = useFieldArray({
    control,
    name: 'fields',
  });

  const [selectedField, setSelectedField] = useState<FieldType | null>(null);
  const [selectedSigner, setSelectedSigner] = useState<Recipient | null>(null);
  const [showRecipientsSelector, setShowRecipientsSelector] = useState(false);

  const selectedSignerStyles = useSelectedSignerStyles(selectedSigner, recipientColorClasses);

  const [isFieldWithinBounds, setIsFieldWithinBounds] = useState(false);
  const [coords, setCoords] = useState({
    x: 0,
    y: 0,
  });

  const fieldBounds = useRef({
    height: 0,
    width: 0,
  });

  const onMouseMove = useCallback(
    (event: MouseEvent) => {
      setIsFieldWithinBounds(
        isWithinPageBounds(
          event,
          PDF_VIEWER_PAGE_SELECTOR,
          fieldBounds.current.width,
          fieldBounds.current.height,
        ),
      );

      setCoords({
        x: event.clientX - fieldBounds.current.width / 2,
        y: event.clientY - fieldBounds.current.height / 2,
      });
    },
    [isWithinPageBounds],
  );

  const onMouseClick = useCallback(
    (event: MouseEvent) => {
      if (!selectedField || !selectedSigner) {
        return;
      }

      const $page = getPage(event, PDF_VIEWER_PAGE_SELECTOR);

      if (
        !$page ||
        !isWithinPageBounds(
          event,
          PDF_VIEWER_PAGE_SELECTOR,
          fieldBounds.current.width,
          fieldBounds.current.height,
        )
      ) {
        setSelectedField(null);
        return;
      }

      const { top, left, height, width } = getBoundingClientRect($page);

      const pageNumber = parseInt($page.getAttribute('data-page-number') ?? '1', 10);

      // Calculate x and y as a percentage of the page width and height
      let pageX = ((event.pageX - left) / width) * 100;
      let pageY = ((event.pageY - top) / height) * 100;

      // Get the bounds as a percentage of the page width and height
      const fieldPageWidth = (fieldBounds.current.width / width) * 100;
      const fieldPageHeight = (fieldBounds.current.height / height) * 100;

      // And center it based on the bounds
      pageX -= fieldPageWidth / 2;
      pageY -= fieldPageHeight / 2;

      append({
        formId: nanoid(12),
        type: selectedField,
        pageNumber,
        pageX,
        pageY,
        pageWidth: fieldPageWidth,
        pageHeight: fieldPageHeight,
        signerEmail: selectedSigner.email,
        signerId: selectedSigner.id,
        signerToken: selectedSigner.token ?? '',
        fieldMeta: undefined,
      });

      setIsFieldWithinBounds(false);
      setSelectedField(null);
    },
    [append, isWithinPageBounds, selectedField, selectedSigner, getPage],
  );

  const onFieldResize = useCallback(
    (node: HTMLElement, index: number) => {
      const field = localFields[index];

      const $page = window.document.querySelector<HTMLElement>(
        `${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.pageNumber}"]`,
      );

      if (!$page) {
        return;
      }

      const {
        x: pageX,
        y: pageY,
        width: pageWidth,
        height: pageHeight,
      } = getFieldPosition($page, node);

      update(index, {
        ...field,
        pageX,
        pageY,
        pageWidth,
        pageHeight,
      });
    },
    [getFieldPosition, localFields, update],
  );

  const onFieldMove = useCallback(
    (node: HTMLElement, index: number) => {
      const field = localFields[index];

      const $page = window.document.querySelector<HTMLElement>(
        `${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.pageNumber}"]`,
      );

      if (!$page) {
        return;
      }

      const { x: pageX, y: pageY } = getFieldPosition($page, node);

      update(index, {
        ...field,
        pageX,
        pageY,
      });
    },
    [getFieldPosition, localFields, update],
  );

  useEffect(() => {
    if (selectedField) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseClick);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseClick);
    };
  }, [onMouseClick, onMouseMove, selectedField]);

  useEffect(() => {
    const observer = new MutationObserver((_mutations) => {
      const $page = document.querySelector(PDF_VIEWER_PAGE_SELECTOR);

      if (!$page) {
        return;
      }

      const { height, width } = $page.getBoundingClientRect();

      fieldBounds.current = {
        height: Math.max(height * (DEFAULT_HEIGHT_PERCENT / 100), MIN_HEIGHT_PX),
        width: Math.max(width * (DEFAULT_WIDTH_PERCENT / 100), MIN_WIDTH_PX),
      };
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    setSelectedSigner(recipients[0]);
  }, [recipients]);

  const recipientsByRole = useMemo(() => {
    const recipientsByRole: Record<RecipientRole, Recipient[]> = {
      CC: [],
      VIEWER: [],
      SIGNER: [],
      APPROVER: [],
    };

    recipients.forEach((recipient) => {
      recipientsByRole[recipient.role].push(recipient);
    });

    return recipientsByRole;
  }, [recipients]);

  const recipientsByRoleToDisplay = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return (Object.entries(recipientsByRole) as [RecipientRole, Recipient[]][]).filter(
      ([role]) => role !== RecipientRole.CC && role !== RecipientRole.VIEWER,
    );
  }, [recipientsByRole]);

  const handleAdvancedSettings = () => {
    setShowAdvancedSettings((prev) => !prev);
  };

  return (
    <>
      {showAdvancedSettings && currentField ? (
        <FieldAdvancedSettings
          title="Advanced settings"
          description={`Configure the ${FRIENDLY_FIELD_TYPE[currentField.type]} field`}
          field={currentField}
          fields={localFields}
          onAdvancedSettings={handleAdvancedSettings}
          onSave={handleSavedFieldSettings}
          teamId={teamId}
        />
      ) : (
        <>
          <DocumentFlowFormContainerHeader
            title={documentFlow.title}
            description={documentFlow.description}
          />
          <DocumentFlowFormContainerContent>
            <div className="flex flex-col">
              {selectedField && (
                <Card
                  className={cn(
                    'pointer-events-none fixed z-50 cursor-pointer border-2 backdrop-blur-[1px]',
                    selectedSignerStyles.activeBorderClass,
                    isFieldWithinBounds
                      ? selectedSignerStyles.activeBorderWithinBoundsClass
                      : selectedSignerStyles.activeBorderOutsideBoundsClass,
                    {
                      'text-field-card-foreground': isFieldWithinBounds,
                      'opacity-50': !isFieldWithinBounds,
                    },
                  )}
                  style={{
                    top: coords.y,
                    left: coords.x,
                    height: fieldBounds.current.height,
                    width: fieldBounds.current.width,
                  }}
                >
                  <CardContent className="flex h-full w-full items-center justify-center p-2">
                    {FRIENDLY_FIELD_TYPE[selectedField]}
                  </CardContent>
                </Card>
              )}

              {localFields.map((field, index) => {
                const recipient = recipients.find((r) => r.email === field.signerEmail);
                const colorClass = recipient ? recipientColorClasses.get(recipient.id) : '';

                return (
                  <FieldItem
                    key={index}
                    field={field}
                    disabled={selectedSigner?.email !== field.signerEmail}
                    minHeight={fieldBounds.current.height}
                    minWidth={fieldBounds.current.width}
                    passive={isFieldWithinBounds && !!selectedField}
                    onResize={(options) => onFieldResize(options, index)}
                    onMove={(options) => onFieldMove(options, index)}
                    onRemove={() => remove(index)}
                    onAdvancedSettings={() => {
                      setCurrentField(field);
                      handleAdvancedSettings();
                    }}
                    color={colorClass || undefined}
                    hideRecipients={hideRecipients}
                  />
                );
              })}

              {!hideRecipients && (
                <Popover open={showRecipientsSelector} onOpenChange={setShowRecipientsSelector}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className={cn(
                        'bg-background text-muted-foreground hover:text-foreground mb-12 mt-2 justify-between border-2 font-normal ring-2 ring-offset-2',
                        selectedSignerStyles.ringClass,
                      )}
                    >
                      {selectedSigner?.email && (
                        <span className="flex-1 truncate text-left">
                          {selectedSigner?.name} ({selectedSigner?.email})
                        </span>
                      )}

                      {!selectedSigner?.email && (
                        <span className="flex-1 truncate text-left">{selectedSigner?.email}</span>
                      )}

                      <ChevronsUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent className="p-0" align="start">
                    <Command value={selectedSigner?.email}>
                      <CommandInput />
                      <CommandEmpty>
                        <span className="text-muted-foreground inline-block px-4">
                          No recipient matching this description was found.
                        </span>
                      </CommandEmpty>

                      {recipientsByRoleToDisplay.map(([role, recipients], roleIndex) => (
                        <CommandGroup key={roleIndex}>
                          <div className="text-muted-foreground mb-1 ml-2 mt-2 text-xs font-medium">
                            {`${RECIPIENT_ROLES_DESCRIPTION[role].roleName}s`}
                          </div>

                          {recipients.length === 0 && (
                            <div
                              key={`${role}-empty`}
                              className="text-muted-foreground/80 px-4 pb-4 pt-2.5 text-center text-xs"
                            >
                              No recipients with this role
                            </div>
                          )}

                          {recipients.map((recipient) => (
                            <CommandItem
                              key={recipient.id}
                              className={cn('px-2 last:mb-1 [&:not(:first-child)]:mt-1')}
                              onSelect={() => {
                                setSelectedSigner(recipient);
                                setShowRecipientsSelector(false);
                              }}
                            >
                              <span
                                className={cn('text-foreground/70 truncate', {
                                  'text-foreground/80': recipient === selectedSigner,
                                })}
                              >
                                {recipient.name && (
                                  <span title={`${recipient.name} (${recipient.email})`}>
                                    {recipient.name} ({recipient.email})
                                  </span>
                                )}

                                {!recipient.name && (
                                  <span title={recipient.email}>{recipient.email}</span>
                                )}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ))}
                    </Command>
                  </PopoverContent>
                </Popover>
              )}

              <div className="-mx-2 flex-1 overflow-y-auto px-2">
                <div className="my-2 grid grid-cols-2 gap-x-4 gap-y-8">
                  <button
                    type="button"
                    className="group h-full w-full"
                    onClick={() => setSelectedField(FieldType.SIGNATURE)}
                    onMouseDown={() => setSelectedField(FieldType.SIGNATURE)}
                    data-selected={selectedField === FieldType.SIGNATURE ? true : undefined}
                  >
                    <Card
                      className={cn(
                        'h-full w-full cursor-pointer group-disabled:opacity-50',
                        selectedSignerStyles.borderClass,
                      )}
                    >
                      <CardContent className="flex flex-col items-center justify-center px-6 py-4">
                        <p
                          className={cn(
                            'text-muted-foreground group-data-[selected]:text-foreground w-full truncate text-3xl font-medium',
                            fontCaveat.className,
                          )}
                        >
                          Signature
                        </p>
                      </CardContent>
                    </Card>
                  </button>

                  <button
                    type="button"
                    className="group h-full w-full"
                    onClick={() => setSelectedField(FieldType.EMAIL)}
                    onMouseDown={() => setSelectedField(FieldType.EMAIL)}
                    data-selected={selectedField === FieldType.EMAIL ? true : undefined}
                  >
                    <Card
                      className={cn(
                        'h-full w-full cursor-pointer group-disabled:opacity-50',
                        selectedSignerStyles.borderClass,
                      )}
                    >
                      <CardContent className="flex flex-col items-center justify-center px-6 py-4">
                        <p
                          className={cn(
                            selectedSigner?.name ? 'mt-1.5' : 'mt-0',
                            'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1 text-xl font-normal',
                          )}
                        >
                          <Mail />
                          Email
                        </p>
                      </CardContent>
                    </Card>
                  </button>

                  <button
                    type="button"
                    className="group h-full w-full"
                    onClick={() => setSelectedField(FieldType.NAME)}
                    onMouseDown={() => setSelectedField(FieldType.NAME)}
                    data-selected={selectedField === FieldType.NAME ? true : undefined}
                  >
                    <Card
                      className={cn(
                        'h-full w-full cursor-pointer group-disabled:opacity-50',
                        selectedSignerStyles.borderClass,
                      )}
                    >
                      <CardContent className="flex flex-col items-center justify-center px-6 py-4">
                        <p
                          className={cn(
                            'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1 text-xl font-normal',
                          )}
                        >
                          <User />
                          Name
                        </p>
                      </CardContent>
                    </Card>
                  </button>

                  <button
                    type="button"
                    className="group h-full w-full"
                    onClick={() => setSelectedField(FieldType.DATE)}
                    onMouseDown={() => setSelectedField(FieldType.DATE)}
                    data-selected={selectedField === FieldType.DATE ? true : undefined}
                  >
                    <Card
                      className={cn(
                        'h-full w-full cursor-pointer group-disabled:opacity-50',
                        selectedSignerStyles.borderClass,
                      )}
                    >
                      <CardContent className="flex flex-col items-center justify-center px-6 py-4">
                        <p
                          className={cn(
                            'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1 text-xl font-normal',
                          )}
                        >
                          <CalendarDays />
                          Date
                        </p>
                      </CardContent>
                    </Card>
                  </button>

                  <button
                    type="button"
                    className="group h-full w-full"
                    onClick={() => setSelectedField(FieldType.TEXT)}
                    onMouseDown={() => setSelectedField(FieldType.TEXT)}
                    data-selected={selectedField === FieldType.TEXT ? true : undefined}
                  >
                    <Card
                      className={cn(
                        'h-full w-full cursor-pointer group-disabled:opacity-50',
                        selectedSignerStyles.borderClass,
                      )}
                    >
                      <CardContent className="flex flex-col items-center justify-center px-6 py-4">
                        <p
                          className={cn(
                            'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1 text-xl font-normal',
                          )}
                        >
                          <Type />
                          Text
                        </p>
                      </CardContent>
                    </Card>
                  </button>

                  <button
                    type="button"
                    className="group h-full w-full"
                    onClick={() => setSelectedField(FieldType.NUMBER)}
                    onMouseDown={() => setSelectedField(FieldType.NUMBER)}
                    data-selected={selectedField === FieldType.NUMBER ? true : undefined}
                  >
                    <Card
                      className={cn(
                        'h-full w-full cursor-pointer group-disabled:opacity-50',
                        selectedSignerStyles.borderClass,
                      )}
                    >
                      <CardContent className="flex flex-col items-center justify-center px-6 py-4">
                        <p
                          className={cn(
                            'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1 text-xl font-normal',
                          )}
                        >
                          <Hash />
                          Number
                        </p>
                      </CardContent>
                    </Card>
                  </button>

                  <button
                    type="button"
                    className="group h-full w-full"
                    onClick={() => setSelectedField(FieldType.RADIO)}
                    onMouseDown={() => setSelectedField(FieldType.RADIO)}
                    data-selected={selectedField === FieldType.RADIO ? true : undefined}
                  >
                    <Card
                      className={cn(
                        'h-full w-full cursor-pointer group-disabled:opacity-50',
                        selectedSignerStyles.borderClass,
                      )}
                    >
                      <CardContent className="flex flex-col items-center justify-center px-6 py-4">
                        <p
                          className={cn(
                            'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1 text-xl font-normal',
                          )}
                        >
                          <Disc />
                          Radio
                        </p>
                      </CardContent>
                    </Card>
                  </button>

                  <button
                    type="button"
                    className="group h-full w-full"
                    onClick={() => setSelectedField(FieldType.CHECKBOX)}
                    onMouseDown={() => setSelectedField(FieldType.CHECKBOX)}
                    data-selected={selectedField === FieldType.CHECKBOX ? true : undefined}
                  >
                    <Card
                      className={cn(
                        'h-full w-full cursor-pointer group-disabled:opacity-50',
                        selectedSignerStyles.borderClass,
                      )}
                    >
                      <CardContent className="flex flex-col items-center justify-center px-6 py-4">
                        <p
                          className={cn(
                            'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1 text-xl font-normal',
                          )}
                        >
                          <CheckSquare />
                          Checkbox
                        </p>
                      </CardContent>
                    </Card>
                  </button>

                  <button
                    type="button"
                    className="group h-full w-full"
                    onClick={() => setSelectedField(FieldType.DROPDOWN)}
                    onMouseDown={() => setSelectedField(FieldType.DROPDOWN)}
                    data-selected={selectedField === FieldType.DROPDOWN ? true : undefined}
                  >
                    <Card
                      className={cn(
                        'h-full w-full cursor-pointer group-disabled:opacity-50',
                        selectedSignerStyles.borderClass,
                      )}
                    >
                      <CardContent className="flex flex-col items-center justify-center px-6 py-4">
                        <p
                          className={cn(
                            'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1 text-xl font-normal',
                          )}
                        >
                          <ChevronDown />
                          Dropdown
                        </p>
                      </CardContent>
                    </Card>
                  </button>
                </div>
              </div>
            </div>
          </DocumentFlowFormContainerContent>

          <DocumentFlowFormContainerFooter>
            <DocumentFlowFormContainerStep
              title={documentFlow.title}
              step={currentStep}
              maxStep={totalSteps}
            />

            <DocumentFlowFormContainerActions
              loading={isSubmitting}
              disabled={isSubmitting}
              goNextLabel="Save Template"
              onGoBackClick={() => {
                previousStep();
                remove();
              }}
              onGoNextClick={() => void onFormSubmit()}
            />
          </DocumentFlowFormContainerFooter>
        </>
      )}
    </>
  );
};
