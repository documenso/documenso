import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { Field, Recipient } from '@prisma/client';
import { FieldType, Prisma, RecipientRole, SendStatus } from '@prisma/client';
import {
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Contact,
  Disc,
  Hash,
  Mail,
  Type,
  User,
} from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useHotkeys } from 'react-hotkeys-hook';

import { getBoundingClientRect } from '@documenso/lib/client-only/get-bounding-client-rect';
import { useAutoSave } from '@documenso/lib/client-only/hooks/use-autosave';
import { useDocumentElement } from '@documenso/lib/client-only/hooks/use-document-element';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import {
  type TFieldMetaSchema as FieldMeta,
  ZFieldMetaSchema,
} from '@documenso/lib/types/field-meta';
import { nanoid } from '@documenso/lib/universal/id';
import { ADVANCED_FIELD_TYPES_WITH_OPTIONAL_SETTING } from '@documenso/lib/utils/advanced-fields-helpers';
import { validateFieldsUninserted } from '@documenso/lib/utils/fields';
import { parseMessageDescriptor } from '@documenso/lib/utils/i18n';
import {
  canRecipientBeModified,
  canRecipientFieldsBeModified,
} from '@documenso/lib/utils/recipients';

import { FieldToolTip } from '../../components/field/field-tooltip';
import { useRecipientColors } from '../../lib/recipient-colors';
import { cn } from '../../lib/utils';
import { Alert, AlertDescription } from '../alert';
import { Card, CardContent } from '../card';
import { Form } from '../form/form';
import { RecipientSelector } from '../recipient-selector';
import { useStep } from '../stepper';
import { useToast } from '../use-toast';
import { type TAddFieldsFormSchema, ZAddFieldsFormSchema } from './add-fields.types';
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

const MIN_HEIGHT_PX = 12;
const MIN_WIDTH_PX = 36;

const DEFAULT_HEIGHT_PX = MIN_HEIGHT_PX * 2.5;
const DEFAULT_WIDTH_PX = MIN_WIDTH_PX * 2.5;

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
  recipientId: number;
  fieldMeta?: FieldMeta;
};

export type AddFieldsFormProps = {
  documentFlow: DocumentFlowStep;
  hideRecipients?: boolean;
  recipients: Recipient[];
  fields: Field[];
  onSubmit: (_data: TAddFieldsFormSchema) => void;
  onAutoSave: (_data: TAddFieldsFormSchema) => Promise<void>;
  canGoBack?: boolean;
  isDocumentPdfLoaded: boolean;
  teamId: number;
};

export const AddFieldsFormPartial = ({
  documentFlow,
  hideRecipients = false,
  recipients,
  fields,
  onSubmit,
  onAutoSave,
  canGoBack = false,
  isDocumentPdfLoaded,
  teamId,
}: AddFieldsFormProps) => {
  const { toast } = useToast();
  const { _ } = useLingui();

  const [isMissingSignatureDialogVisible, setIsMissingSignatureDialogVisible] = useState(false);

  const { isWithinPageBounds, getFieldPosition, getPage } = useDocumentElement();
  const { currentStep, totalSteps, previousStep } = useStep();
  const canRenderBackButtonAsRemove =
    currentStep === 1 && typeof documentFlow.onBackStep === 'function' && canGoBack;
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [currentField, setCurrentField] = useState<FieldFormType>();
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

  const form = useForm<TAddFieldsFormSchema>({
    defaultValues: {
      fields: fields.map((field) => ({
        nativeId: field.id,
        formId: `${field.id}-${field.envelopeItemId}`,
        pageNumber: field.page,
        type: field.type,
        pageX: Number(field.positionX),
        pageY: Number(field.positionY),
        pageWidth: Number(field.width),
        pageHeight: Number(field.height),
        signerEmail:
          recipients.find((recipient) => recipient.id === field.recipientId)?.email ?? '',
        recipientId: field.recipientId,
        fieldMeta: field.fieldMeta ? ZFieldMetaSchema.parse(field.fieldMeta) : undefined,
      })),
    },
    resolver: zodResolver(ZAddFieldsFormSchema),
  });

  useHotkeys(['ctrl+c', 'meta+c'], (evt) => onFieldCopy(evt));
  useHotkeys(['ctrl+v', 'meta+v'], (evt) => onFieldPaste(evt));
  useHotkeys(['ctrl+d', 'meta+d'], (evt) => onFieldCopy(evt, { duplicate: true }));

  const onFormSubmit = form.handleSubmit(onSubmit);

  const handleSavedFieldSettings = (fieldState: FieldMeta) => {
    const initialValues = form.getValues();

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

    form.setValue('fields', updatedFields);
  };

  const {
    append,
    remove,
    update,
    fields: localFields,
  } = useFieldArray({
    control: form.control,
    name: 'fields',
  });

  const [selectedField, setSelectedField] = useState<FieldType | null>(null);
  const [selectedSigner, setSelectedSigner] = useState<Recipient | null>(null);
  const [lastActiveField, setLastActiveField] = useState<TAddFieldsFormSchema['fields'][0] | null>(
    null,
  );
  const [fieldClipboard, setFieldClipboard] = useState<TAddFieldsFormSchema['fields'][0] | null>(
    null,
  );
  const selectedSignerIndex = recipients.findIndex((r) => r.id === selectedSigner?.id);
  const selectedSignerStyles = useRecipientColors(
    selectedSignerIndex === -1 ? 0 : selectedSignerIndex,
  );

  const [validateUninsertedFields, setValidateUninsertedFields] = useState(false);

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

  const fieldsWithError = useMemo(() => {
    const fields = localFields.filter((field) => {
      const hasError =
        ((field.type === FieldType.CHECKBOX ||
          field.type === FieldType.RADIO ||
          field.type === FieldType.DROPDOWN) &&
          field.fieldMeta === undefined) ||
        (field.fieldMeta && 'values' in field.fieldMeta && field?.fieldMeta?.values?.length === 0);

      return hasError;
    });

    const mappedFields = fields.map((field) => ({
      id: field.nativeId ?? 0,
      secondaryId: field.formId,
      documentId: null,
      templateId: null,
      recipientId: 0,
      type: field.type,
      page: field.pageNumber,
      positionX: new Prisma.Decimal(field.pageX),
      positionY: new Prisma.Decimal(field.pageY),
      width: new Prisma.Decimal(field.pageWidth),
      height: new Prisma.Decimal(field.pageHeight),
      customText: '',
      inserted: true,
      fieldMeta: field.fieldMeta ?? null,
    }));

    return mappedFields;
  }, [localFields]);

  const isFieldsDisabled = useMemo(() => {
    if (!selectedSigner) {
      return true;
    }

    return !canRecipientFieldsBeModified(selectedSigner, fields);
  }, [selectedSigner, fields]);

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

      const field = {
        formId: nanoid(12),
        nativeId: undefined,
        type: selectedField,
        pageNumber,
        pageX,
        pageY,
        pageWidth: fieldPageWidth,
        pageHeight: fieldPageHeight,
        signerEmail: selectedSigner.email,
        recipientId: selectedSigner.id,
        fieldMeta: undefined,
      };

      append(field);

      // Only open fields with significant amount of settings (instead of just a font setting) to
      // reduce friction when adding fields.
      if (ADVANCED_FIELD_TYPES_WITH_OPTIONAL_SETTING.includes(selectedField)) {
        setCurrentField(field);
        setShowAdvancedSettings(true);
      }

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

  const onFieldCopy = useCallback(
    (event?: KeyboardEvent | null, options?: { duplicate?: boolean; duplicateAll?: boolean }) => {
      const { duplicate = false, duplicateAll = false } = options ?? {};

      if (lastActiveField) {
        event?.preventDefault();

        if (duplicate) {
          const newField: TAddFieldsFormSchema['fields'][0] = {
            ...structuredClone(lastActiveField),
            nativeId: undefined,
            formId: nanoid(12),
            signerEmail: selectedSigner?.email ?? lastActiveField.signerEmail,
            recipientId: selectedSigner?.id ?? lastActiveField.recipientId,
            pageX: lastActiveField.pageX + 3,
            pageY: lastActiveField.pageY + 3,
          };

          append(newField);

          return;
        }

        if (duplicateAll) {
          const pages = Array.from(document.querySelectorAll(PDF_VIEWER_PAGE_SELECTOR));

          pages.forEach((_, index) => {
            const pageNumber = index + 1;

            if (pageNumber === lastActiveField.pageNumber) {
              return;
            }

            const newField: TAddFieldsFormSchema['fields'][0] = {
              ...structuredClone(lastActiveField),
              nativeId: undefined,
              formId: nanoid(12),
              signerEmail: selectedSigner?.email ?? lastActiveField.signerEmail,
              recipientId: selectedSigner?.id ?? lastActiveField.recipientId,
              pageNumber,
            };

            append(newField);
          });

          return;
        }

        setFieldClipboard(lastActiveField);

        toast({
          title: _(msg`Copied field`),
          description: _(msg`Copied field to clipboard`),
        });
      }
    },
    [append, lastActiveField, selectedSigner?.email, selectedSigner?.id, toast],
  );

  const onFieldPaste = useCallback(
    (event: KeyboardEvent) => {
      if (fieldClipboard) {
        event.preventDefault();

        const copiedField = structuredClone(fieldClipboard);

        append({
          ...copiedField,
          nativeId: undefined,
          formId: nanoid(12),
          signerEmail: selectedSigner?.email ?? copiedField.signerEmail,
          recipientId: selectedSigner?.id ?? copiedField.recipientId,
          pageX: copiedField.pageX + 3,
          pageY: copiedField.pageY + 3,
        });
      }
    },
    [append, fieldClipboard, selectedSigner?.email],
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
        height: Math.max(DEFAULT_HEIGHT_PX),
        width: Math.max(DEFAULT_WIDTH_PX),
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
    const recipientsByRoleToDisplay = recipients.filter(
      (recipient) =>
        recipient.role !== RecipientRole.CC && recipient.role !== RecipientRole.ASSISTANT,
    );

    setSelectedSigner(
      recipientsByRoleToDisplay.find((r) => r.sendStatus !== SendStatus.SENT) ??
        recipientsByRoleToDisplay[0],
    );
  }, [recipients]);

  const recipientsByRole = useMemo(() => {
    const recipientsByRole: Record<RecipientRole, Recipient[]> = {
      CC: [],
      VIEWER: [],
      SIGNER: [],
      APPROVER: [],
      ASSISTANT: [],
    };

    recipients.forEach((recipient) => {
      recipientsByRole[recipient.role].push(recipient);
    });

    return recipientsByRole;
  }, [recipients]);

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
      return;
    }

    setValidateUninsertedFields(true);
    const isFieldsValid = validateFieldsUninserted();

    if (!isFieldsValid) {
      return;
    } else {
      void onFormSubmit();
    }
  };

  const { scheduleSave } = useAutoSave(onAutoSave);

  const handleAutoSave = async () => {
    const isFormValid = await form.trigger();

    if (!isFormValid) {
      return;
    }

    const formData = form.getValues();

    scheduleSave(formData);
  };

  return (
    <>
      {showAdvancedSettings && currentField ? (
        <FieldAdvancedSettings
          title={msg`Advanced settings`}
          description={msg`Configure the ${parseMessageDescriptor(
            _,
            FRIENDLY_FIELD_TYPE[currentField.type],
          )} field`}
          field={currentField}
          fields={localFields}
          onAdvancedSettings={handleAdvancedSettings}
          isDocumentPdfLoaded={isDocumentPdfLoaded}
          onSave={(fieldState) => {
            handleSavedFieldSettings(fieldState);
            void handleAutoSave();
          }}
          onAutoSave={async (fieldState) => {
            handleSavedFieldSettings(fieldState);
            await handleAutoSave();
          }}
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
                    'text-muted-foreground dark:text-muted-background pointer-events-none fixed z-50 flex cursor-pointer flex-col items-center justify-center rounded-[2px] bg-white ring-2 transition duration-200 [container-type:size]',
                    selectedSignerStyles?.base,
                    {
                      '-rotate-6 scale-90 opacity-50 dark:bg-black/20': !isFieldWithinBounds,
                      'dark:text-black/60': isFieldWithinBounds,
                    },
                  )}
                  style={{
                    top: coords.y,
                    left: coords.x,
                    height: fieldBounds.current.height,
                    width: fieldBounds.current.width,
                  }}
                >
                  <span className="text-[clamp(0.425rem,25cqw,0.825rem)]">
                    {parseMessageDescriptor(_, FRIENDLY_FIELD_TYPE[selectedField])}
                  </span>
                </div>
              )}

              {isDocumentPdfLoaded &&
                localFields.map((field, index) => {
                  const recipientIndex = recipients.findIndex((r) => r.id === field.recipientId);
                  const hasFieldError =
                    emptyCheckboxFields.find((f) => f.formId === field.formId) ||
                    emptyRadioFields.find((f) => f.formId === field.formId) ||
                    emptySelectFields.find((f) => f.formId === field.formId);

                  return (
                    <FieldItem
                      key={index}
                      recipientIndex={recipientIndex === -1 ? 0 : recipientIndex}
                      field={field}
                      disabled={
                        selectedSigner?.email !== field.signerEmail ||
                        !canRecipientBeModified(selectedSigner, fields)
                      }
                      minHeight={MIN_HEIGHT_PX}
                      minWidth={MIN_WIDTH_PX}
                      defaultHeight={DEFAULT_HEIGHT_PX}
                      defaultWidth={DEFAULT_WIDTH_PX}
                      passive={isFieldWithinBounds && !!selectedField}
                      onFocus={() => setLastActiveField(field)}
                      onBlur={() => {
                        setLastActiveField(null);
                        void handleAutoSave();
                      }}
                      onMouseEnter={() => setLastActiveField(field)}
                      onMouseLeave={() => setLastActiveField(null)}
                      onResize={(options) => onFieldResize(options, index)}
                      onMove={(options) => onFieldMove(options, index)}
                      onRemove={() => {
                        remove(index);
                        void handleAutoSave();
                      }}
                      onDuplicate={() => {
                        onFieldCopy(null, { duplicate: true });
                        void handleAutoSave();
                      }}
                      onDuplicateAllPages={() => {
                        onFieldCopy(null, { duplicateAll: true });
                        void handleAutoSave();
                      }}
                      onAdvancedSettings={() => {
                        setCurrentField(field);
                        handleAdvancedSettings();
                      }}
                      hasErrors={!!hasFieldError}
                      active={activeFieldId === field.formId}
                      onFieldActivate={() => setActiveFieldId(field.formId)}
                      onFieldDeactivate={() => setActiveFieldId(null)}
                    />
                  );
                })}

              {!hideRecipients && (
                <RecipientSelector
                  selectedRecipient={selectedSigner}
                  onSelectedRecipientChange={setSelectedSigner}
                  recipients={recipients}
                  className="mb-12 mt-2"
                />
              )}

              <Form {...form}>
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
                        )}
                      >
                        <CardContent className="flex flex-col items-center justify-center px-6 py-4">
                          <p
                            className={cn(
                              'text-muted-foreground group-data-[selected]:text-foreground font-signature flex items-center justify-center gap-x-1.5 text-lg font-normal',
                            )}
                          >
                            <Trans>Signature</Trans>
                          </p>
                        </CardContent>
                      </Card>
                    </button>

                    <button
                      type="button"
                      className="group h-full w-full"
                      onClick={() => setSelectedField(FieldType.INITIALS)}
                      onMouseDown={() => setSelectedField(FieldType.INITIALS)}
                      data-selected={selectedField === FieldType.INITIALS ? true : undefined}
                    >
                      <Card
                        className={cn(
                          'flex h-full w-full cursor-pointer items-center justify-center group-disabled:opacity-50',
                        )}
                      >
                        <CardContent className="flex flex-col items-center justify-center px-6 py-4">
                          <p
                            className={cn(
                              'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1.5 text-sm font-normal',
                            )}
                          >
                            <Contact className="h-4 w-4" />
                            Initials
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
                        )}
                      >
                        <CardContent className="flex flex-col items-center justify-center px-6 py-4">
                          <p
                            className={cn(
                              'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1.5 text-sm font-normal',
                            )}
                          >
                            <Mail className="h-4 w-4" />
                            <Trans>Email</Trans>
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
                        )}
                      >
                        <CardContent className="p-4">
                          <p
                            className={cn(
                              'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1.5 text-sm font-normal',
                            )}
                          >
                            <User className="h-4 w-4" />
                            <Trans>Name</Trans>
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
                        )}
                      >
                        <CardContent className="p-4">
                          <p
                            className={cn(
                              'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1.5 text-sm font-normal',
                            )}
                          >
                            <CalendarDays className="h-4 w-4" />
                            <Trans>Date</Trans>
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
                        )}
                      >
                        <CardContent className="p-4">
                          <p
                            className={cn(
                              'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1.5 text-sm font-normal',
                            )}
                          >
                            <Type className="h-4 w-4" />
                            <Trans>Text</Trans>
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
                        )}
                      >
                        <CardContent className="p-4">
                          <p
                            className={cn(
                              'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1.5 text-sm font-normal',
                            )}
                          >
                            <Hash className="h-4 w-4" />
                            <Trans>Number</Trans>
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
                        )}
                      >
                        <CardContent className="p-4">
                          <p
                            className={cn(
                              'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1.5 text-sm font-normal',
                            )}
                          >
                            <CheckSquare className="h-4 w-4" />
                            {/* Not translated on purpose. */}
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
                        )}
                      >
                        <CardContent className="p-4">
                          <p
                            className={cn(
                              'text-muted-foreground group-data-[selected]:text-foreground flex items-center justify-center gap-x-1.5 text-sm font-normal',
                            )}
                          >
                            <ChevronDown className="h-4 w-4" />
                            <Trans>Dropdown</Trans>
                          </p>
                        </CardContent>
                      </Card>
                    </button>
                  </fieldset>
                </div>
              </Form>
            </div>
          </DocumentFlowFormContainerContent>

          {hasErrors && (
            <div className="mt-4">
              <ul>
                <li className="text-sm text-red-500">
                  <Trans>
                    To proceed further, please set at least one value for the{' '}
                    {emptyCheckboxFields.length > 0
                      ? 'Checkbox'
                      : emptyRadioFields.length > 0
                        ? 'Radio'
                        : 'Select'}{' '}
                    field.
                  </Trans>
                </li>
              </ul>
            </div>
          )}

          {selectedSigner && !canRecipientFieldsBeModified(selectedSigner, fields) && (
            <Alert variant="warning">
              <AlertDescription>
                <Trans>
                  This recipient can no longer be modified as they have signed a field, or completed
                  the document.
                </Trans>
              </AlertDescription>
            </Alert>
          )}

          <DocumentFlowFormContainerFooter>
            <DocumentFlowFormContainerStep step={currentStep} maxStep={totalSteps} />

            <DocumentFlowFormContainerActions
              loading={form.formState.isSubmitting}
              disabled={form.formState.isSubmitting}
              disableNextStep={hasErrors}
              onGoBackClick={() => {
                previousStep();
                remove();
                documentFlow.onBackStep?.();
              }}
              goBackLabel={canRenderBackButtonAsRemove ? msg`Remove` : undefined}
              onGoNextClick={handleGoNextClick}
            />
          </DocumentFlowFormContainerFooter>

          <MissingSignatureFieldDialog
            isOpen={isMissingSignatureDialogVisible}
            onOpenChange={(value) => setIsMissingSignatureDialogVisible(value)}
          />
        </>
      )}
      {validateUninsertedFields && fieldsWithError[0] && (
        <FieldToolTip key={fieldsWithError[0].id} field={fieldsWithError[0]} color="warning">
          <Trans>Empty field</Trans>
        </FieldToolTip>
      )}
    </>
  );
};
