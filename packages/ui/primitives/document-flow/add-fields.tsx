'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Caveat } from 'next/font/google';

import {
  CalendarDays,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronsUpDown,
  Disc,
  Hash,
  Info,
  Mail,
  Type,
  User,
} from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';

import { getBoundingClientRect } from '@documenso/lib/client-only/get-bounding-client-rect';
import { useDocumentElement } from '@documenso/lib/client-only/hooks/use-document-element';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import {
  type TFieldMetaSchema as FieldMeta,
  ZFieldMetaSchema,
} from '@documenso/lib/types/field-meta';
import { nanoid } from '@documenso/lib/universal/id';
import type { Field, Recipient } from '@documenso/prisma/client';
import { FieldType, RecipientRole, SendStatus } from '@documenso/prisma/client';

import { getSignerColorStyles, useSignerColors } from '../../lib/signer-colors';
import { cn } from '../../lib/utils';
import { Button } from '../button';
import { Card, CardContent } from '../card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '../command';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';
import { useStep } from '../stepper';
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip';
import type { TAddFieldsFormSchema } from './add-fields.types';
import {
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerHeader,
  DocumentFlowFormContainerStep,
} from './document-flow-root';
import { FieldItem } from './field-item';
import { FieldAdvancedSettings } from './field-item-advanced-settings';
import { MissingSignatureFieldDialog } from './missing-signature-field-dialog';
import { type DocumentFlowStep, FRIENDLY_FIELD_TYPE } from './types';

const fontCaveat = Caveat({
  weight: ['500'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-caveat',
});

const MIN_HEIGHT_PX = 40;
const MIN_WIDTH_PX = 140;

export type FieldFormType = {
  nativeId?: number;
  formId: string;
  pageNumber: number;
  type: FieldType;
  pageX: number;
  pageY: number;
  pageWidth: number;
  pageHeight: number;
  signerEmail: string;
  fieldMeta?: FieldMeta;
};

export type AddFieldsFormProps = {
  documentFlow: DocumentFlowStep;
  hideRecipients?: boolean;
  recipients: Recipient[];
  fields: Field[];
  onSubmit: (_data: TAddFieldsFormSchema) => void;
  canGoBack?: boolean;
  isDocumentPdfLoaded: boolean;
  teamId?: number;
};

/*
  I hate this, but due to TailwindCSS JIT, I couldnn't find a better way to do this for now.

  TODO: Try to find a better way to do this.
*/

export const AddFieldsFormPartial = ({
  documentFlow,
  hideRecipients = false,
  recipients,
  fields,
  onSubmit,
  canGoBack = false,
  isDocumentPdfLoaded,
  teamId,
}: AddFieldsFormProps) => {
  const [isMissingSignatureDialogVisible, setIsMissingSignatureDialogVisible] = useState(false);

  const { isWithinPageBounds, getFieldPosition, getPage } = useDocumentElement();
  const { currentStep, totalSteps, previousStep } = useStep();
  const canRenderBackButtonAsRemove =
    currentStep === 1 && typeof documentFlow.onBackStep === 'function' && canGoBack;
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [currentField, setCurrentField] = useState<FieldFormType>();

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
    setValue,
    getValues,
  } = useForm<TAddFieldsFormSchema>({
    defaultValues: {
      fields: fields.map((field) => ({
        nativeId: field.id,
        formId: `${field.id}-${field.documentId}`,
        pageNumber: field.page,
        type: field.type,
        pageX: Number(field.positionX),
        pageY: Number(field.positionY),
        pageWidth: Number(field.width),
        pageHeight: Number(field.height),
        signerEmail:
          recipients.find((recipient) => recipient.id === field.recipientId)?.email ?? '',
        fieldMeta: field.fieldMeta ? ZFieldMetaSchema.parse(field.fieldMeta) : undefined,
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
  const selectedSignerIndex = recipients.findIndex((r) => r.id === selectedSigner?.id);
  const selectedSignerStyles = useSignerColors(
    selectedSignerIndex === -1 ? 0 : selectedSignerIndex,
  );

  const hasSelectedSignerBeenSent = selectedSigner?.sendStatus === SendStatus.SENT;

  const filterFieldsWithEmptyValues = (fields: typeof localFields, fieldType: string) =>
    fields
      .filter((field) => field.type === fieldType)
      .filter((field) => {
        if (field.fieldMeta && 'values' in field.fieldMeta) {
          return field.fieldMeta.values?.length === 0;
        }

        return true;
      });

  const emptyCheckboxFields = useMemo(
    () => filterFieldsWithEmptyValues(localFields, FieldType.CHECKBOX),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localFields],
  );

  const emptyRadioFields = useMemo(
    () => filterFieldsWithEmptyValues(localFields, FieldType.RADIO),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localFields],
  );

  const emptySelectFields = useMemo(
    () => filterFieldsWithEmptyValues(localFields, FieldType.DROPDOWN),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localFields],
  );

  const hasErrors =
    emptyCheckboxFields.length > 0 || emptyRadioFields.length > 0 || emptySelectFields.length > 0;

  const isFieldsDisabled =
    !selectedSigner ||
    hasSelectedSignerBeenSent ||
    selectedSigner?.role === RecipientRole.VIEWER ||
    selectedSigner?.role === RecipientRole.CC;

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

      fieldBounds.current = {
        height: Math.max(MIN_HEIGHT_PX),
        width: Math.max(MIN_WIDTH_PX),
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
    setSelectedSigner(recipients.find((r) => r.sendStatus !== SendStatus.SENT) ?? recipients[0]);
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

  const handleGoNextClick = () => {
    const everySignerHasSignature = recipientsByRole.SIGNER.every((signer) =>
      localFields.some(
        (field) =>
          (field.type === FieldType.SIGNATURE || field.type === FieldType.FREE_SIGNATURE) &&
          field.signerEmail === signer.email,
      ),
    );

    if (!everySignerHasSignature) {
      setIsMissingSignatureDialogVisible(true);
    } else {
      void onFormSubmit();
    }
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
          isDocumentPdfLoaded={isDocumentPdfLoaded}
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
                <div
                  className={cn(
                    'pointer-events-none fixed z-50 flex cursor-pointer flex-col items-center justify-center bg-white transition duration-200',
                    selectedSignerStyles.default.base,
                    {
                      '-rotate-6 scale-90 opacity-50': !isFieldWithinBounds,
                    },
                  )}
                  style={{
                    top: coords.y,
                    left: coords.x,
                    height: fieldBounds.current.height,
                    width: fieldBounds.current.width,
                  }}
                >
                  {FRIENDLY_FIELD_TYPE[selectedField]}
                </div>
              )}

              {isDocumentPdfLoaded &&
                localFields.map((field, index) => {
                  const recipientIndex = recipients.findIndex((r) => r.email === field.signerEmail);

                  return (
                    <FieldItem
                      key={index}
                      recipientIndex={recipientIndex === -1 ? 0 : recipientIndex}
                      field={field}
                      disabled={
                        selectedSigner?.email !== field.signerEmail || hasSelectedSignerBeenSent
                      }
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
                        'bg-background text-muted-foreground hover:text-foreground mb-12 mt-2 justify-between font-normal',
                        selectedSignerStyles.default.base,
                      )}
                    >
                      {selectedSigner?.email && (
                        <span className="flex-1 truncate text-left">
                          {selectedSigner?.name} ({selectedSigner?.email})
                        </span>
                      )}

                      {!selectedSigner?.email && (
                        <span className="gradie flex-1 truncate text-left">
                          {selectedSigner?.email}
                        </span>
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

                      {recipientsByRoleToDisplay.map(([role, roleRecipients], roleIndex) => (
                        <CommandGroup key={roleIndex}>
                          <div className="text-muted-foreground mb-1 ml-2 mt-2 text-xs font-medium">
                            {`${RECIPIENT_ROLES_DESCRIPTION[role].roleName}s`}
                          </div>

                          {roleRecipients.length === 0 && (
                            <div
                              key={`${role}-empty`}
                              className="text-muted-foreground/80 px-4 pb-4 pt-2.5 text-center text-xs"
                            >
                              No recipients with this role
                            </div>
                          )}

                          {roleRecipients.map((recipient) => (
                            <CommandItem
                              key={recipient.id}
                              className={cn(
                                'px-2 last:mb-1 [&:not(:first-child)]:mt-1',
                                getSignerColorStyles(
                                  Math.max(
                                    recipients.findIndex((r) => r.id === recipient.id),
                                    0,
                                  ),
                                ).default.comboxBoxItem,
                                {
                                  'text-muted-foreground': recipient.sendStatus === SendStatus.SENT,
                                },
                              )}
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

                              <div className="ml-auto flex items-center justify-center">
                                {recipient.sendStatus !== SendStatus.SENT ? (
                                  <Check
                                    aria-hidden={recipient !== selectedSigner}
                                    className={cn('h-4 w-4 flex-shrink-0', {
                                      'opacity-0': recipient !== selectedSigner,
                                      'opacity-100': recipient === selectedSigner,
                                    })}
                                  />
                                ) : (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Info className="ml-2 h-4 w-4" />
                                    </TooltipTrigger>

                                    <TooltipContent className="text-muted-foreground max-w-xs">
                                      This document has already been sent to this recipient. You can
                                      no longer edit this recipient.
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ))}
                    </Command>
                  </PopoverContent>
                </Popover>
              )}

              <div className="-mx-2 flex-1 overflow-y-auto px-2">
                <fieldset disabled={isFieldsDisabled} className="my-2 grid grid-cols-3 gap-4">
                  <button
                    type="button"
                    className="group h-full w-full"
                    onClick={() => setSelectedField(FieldType.SIGNATURE)}
                    onMouseDown={() => setSelectedField(FieldType.SIGNATURE)}
                    data-selected={selectedField === FieldType.SIGNATURE ? true : undefined}
                  >
                    <Card
                      className={cn(
                        'flex h-full w-full cursor-pointer items-center justify-center group-disabled:opacity-50',
                        // selectedSignerStyles.borderClass,
                      )}
                    >
                      <CardContent className="flex flex-col items-center justify-center px-6 py-4">
                        <p
                          className={cn(
                            'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1.5 text-lg font-normal',
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
                        'flex h-full w-full cursor-pointer items-center justify-center group-disabled:opacity-50',
                        // selectedSignerStyles.borderClass,
                      )}
                    >
                      <CardContent className="p-4">
                        <p
                          className={cn(
                            'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1.5 text-sm font-normal',
                          )}
                        >
                          <Mail className="h-4 w-4" />
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
                        'flex h-full w-full cursor-pointer items-center justify-center group-disabled:opacity-50',
                        // selectedSignerStyles.borderClass,
                      )}
                    >
                      <CardContent className="p-4">
                        <p
                          className={cn(
                            'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1.5 text-sm font-normal',
                          )}
                        >
                          <User className="h-4 w-4" />
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
                        'flex h-full w-full cursor-pointer items-center justify-center group-disabled:opacity-50',
                        // selectedSignerStyles.borderClass,
                      )}
                    >
                      <CardContent className="p-4">
                        <p
                          className={cn(
                            'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1.5 text-sm font-normal',
                          )}
                        >
                          <CalendarDays className="h-4 w-4" />
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
                        'flex h-full w-full cursor-pointer items-center justify-center group-disabled:opacity-50',
                        // selectedSignerStyles.borderClass,
                      )}
                    >
                      <CardContent className="p-4">
                        <p
                          className={cn(
                            'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1.5 text-sm font-normal',
                          )}
                        >
                          <Type className="h-4 w-4" />
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
                        'flex h-full w-full cursor-pointer items-center justify-center group-disabled:opacity-50',
                        // selectedSignerStyles.borderClass,
                      )}
                    >
                      <CardContent className="p-4">
                        <p
                          className={cn(
                            'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1.5 text-sm font-normal',
                          )}
                        >
                          <Hash className="h-4 w-4" />
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
                        'flex h-full w-full cursor-pointer items-center justify-center group-disabled:opacity-50',
                        // selectedSignerStyles.borderClass,
                      )}
                    >
                      <CardContent className="p-4">
                        <p
                          className={cn(
                            'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1.5 text-sm font-normal',
                          )}
                        >
                          <Disc className="h-4 w-4" />
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
                        'flex h-full w-full cursor-pointer items-center justify-center group-disabled:opacity-50',
                        // selectedSignerStyles.borderClass,
                      )}
                    >
                      <CardContent className="p-4">
                        <p
                          className={cn(
                            'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1.5 text-sm font-normal',
                          )}
                        >
                          <CheckSquare className="h-4 w-4" />
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
                        'flex h-full w-full cursor-pointer items-center justify-center group-disabled:opacity-50',
                        // selectedSignerStyles.borderClass,
                      )}
                    >
                      <CardContent className="p-4">
                        <p
                          className={cn(
                            'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1.5 text-sm font-normal',
                          )}
                        >
                          <ChevronDown className="h-4 w-4" />
                          Dropdown
                        </p>
                      </CardContent>
                    </Card>
                  </button>
                </fieldset>
              </div>
            </div>
          </DocumentFlowFormContainerContent>
          {hasErrors && (
            <div className="mt-4">
              <ul>
                <li className="text-sm text-red-500">
                  To proceed further, please set at least one value for the{' '}
                  {emptyCheckboxFields.length > 0
                    ? 'Checkbox'
                    : emptyRadioFields.length > 0
                    ? 'Radio'
                    : 'Select'}{' '}
                  field.
                </li>
              </ul>
            </div>
          )}
          <DocumentFlowFormContainerFooter>
            <DocumentFlowFormContainerStep
              title={documentFlow.title}
              step={currentStep}
              maxStep={totalSteps}
            />

            <DocumentFlowFormContainerActions
              loading={isSubmitting}
              disabled={isSubmitting}
              disableNextStep={hasErrors}
              onGoBackClick={() => {
                previousStep();
                remove();
                documentFlow.onBackStep?.();
              }}
              goBackLabel={canRenderBackButtonAsRemove ? 'Remove' : undefined}
              onGoNextClick={handleGoNextClick}
            />
          </DocumentFlowFormContainerFooter>

          <MissingSignatureFieldDialog
            isOpen={isMissingSignatureDialogVisible}
            onOpenChange={(value) => setIsMissingSignatureDialogVisible(value)}
          />
        </>
      )}
    </>
  );
};
