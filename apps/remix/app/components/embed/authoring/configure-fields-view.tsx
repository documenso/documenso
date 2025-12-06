import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { EnvelopeItem, FieldType } from '@prisma/client';
import { ReadStatus, type Recipient, SendStatus, SigningStatus } from '@prisma/client';
import { base64 } from '@scure/base';
import { ChevronsUpDown } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useHotkeys } from 'react-hotkeys-hook';

import { getBoundingClientRect } from '@documenso/lib/client-only/get-bounding-client-rect';
import { useDocumentElement } from '@documenso/lib/client-only/hooks/use-document-element';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { type TFieldMetaSchema, ZFieldMetaSchema } from '@documenso/lib/types/field-meta';
import { nanoid } from '@documenso/lib/universal/id';
import { ADVANCED_FIELD_TYPES_WITH_OPTIONAL_SETTING } from '@documenso/lib/utils/advanced-fields-helpers';
import { useRecipientColors } from '@documenso/ui/lib/recipient-colors';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { FieldItem } from '@documenso/ui/primitives/document-flow/field-item';
import { FRIENDLY_FIELD_TYPE } from '@documenso/ui/primitives/document-flow/types';
import { ElementVisible } from '@documenso/ui/primitives/element-visible';
import { FieldSelector } from '@documenso/ui/primitives/field-selector';
import { Form } from '@documenso/ui/primitives/form/form';
import { PDFViewerLazy } from '@documenso/ui/primitives/pdf-viewer/lazy';
import { RecipientSelector } from '@documenso/ui/primitives/recipient-selector';
import { Sheet, SheetContent, SheetTrigger } from '@documenso/ui/primitives/sheet';
import { useToast } from '@documenso/ui/primitives/use-toast';

import type { TConfigureEmbedFormSchema } from './configure-document-view.types';
import type { TConfigureFieldsFormSchema } from './configure-fields-view.types';
import { FieldAdvancedSettingsDrawer } from './field-advanced-settings-drawer';

const MIN_HEIGHT_PX = 12;
const MIN_WIDTH_PX = 36;

const DEFAULT_HEIGHT_PX = MIN_HEIGHT_PX * 2.5;
const DEFAULT_WIDTH_PX = MIN_WIDTH_PX * 2.5;

export type ConfigureFieldsViewProps = {
  configData: TConfigureEmbedFormSchema;
  presignToken?: string | undefined;
  envelopeItem?: Pick<EnvelopeItem, 'id' | 'envelopeId'>;
  defaultValues?: Partial<TConfigureFieldsFormSchema>;
  onBack?: (data: TConfigureFieldsFormSchema) => void;
  onSubmit: (data: TConfigureFieldsFormSchema) => void;
};

export const ConfigureFieldsView = ({
  configData,
  presignToken,
  envelopeItem,
  defaultValues,
  onBack,
  onSubmit,
}: ConfigureFieldsViewProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { isWithinPageBounds, getFieldPosition, getPage } = useDocumentElement();

  // Track if we're on a mobile device
  const [isMobile, setIsMobile] = useState(false);

  // State for managing the mobile drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Check for mobile viewport on component mount and resize
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Initial check
    checkIfMobile();

    // Add resize listener
    window.addEventListener('resize', checkIfMobile);

    // Cleanup
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  const normalizedDocumentData = useMemo(() => {
    if (envelopeItem) {
      return undefined;
    }

    if (!configData.documentData) {
      return undefined;
    }

    return base64.encode(configData.documentData.data);
  }, [configData.documentData]);

  const normalizedEnvelopeItem = useMemo(() => {
    if (envelopeItem) {
      return envelopeItem;
    }

    return { id: '', envelopeId: '' };
  }, [envelopeItem]);

  const recipients = useMemo(() => {
    return configData.signers.map<Recipient>((signer, index) => ({
      id: signer.nativeId || index,
      name: signer.name || '',
      email: signer.email || '',
      role: signer.role,
      signingOrder: signer.signingOrder || null,
      documentId: null,
      templateId: null,
      token: '',
      documentDeletedAt: null,
      expired: null,
      signedAt: null,
      authOptions: null,
      rejectionReason: null,
      sendStatus: signer.disabled ? SendStatus.SENT : SendStatus.NOT_SENT,
      readStatus: signer.disabled ? ReadStatus.OPENED : ReadStatus.NOT_OPENED,
      signingStatus: signer.disabled ? SigningStatus.SIGNED : SigningStatus.NOT_SIGNED,
      envelopeId: '',
    }));
  }, [configData.signers]);

  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(
    () => recipients.find((r) => r.signingStatus === SigningStatus.NOT_SIGNED) || null,
  );
  const [selectedField, setSelectedField] = useState<FieldType | null>(null);
  const [isFieldWithinBounds, setIsFieldWithinBounds] = useState(false);
  const [coords, setCoords] = useState({
    x: 0,
    y: 0,
  });
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [lastActiveField, setLastActiveField] = useState<
    TConfigureFieldsFormSchema['fields'][0] | null
  >(null);
  const [fieldClipboard, setFieldClipboard] = useState<
    TConfigureFieldsFormSchema['fields'][0] | null
  >(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [currentField, setCurrentField] = useState<TConfigureFieldsFormSchema['fields'][0] | null>(
    null,
  );

  const fieldBounds = useRef({
    height: DEFAULT_HEIGHT_PX,
    width: DEFAULT_WIDTH_PX,
  });

  const selectedRecipientIndex = recipients.findIndex((r) => r.id === selectedRecipient?.id);
  const selectedRecipientStyles = useRecipientColors(
    selectedRecipientIndex === -1 ? 0 : selectedRecipientIndex,
  );

  const form = useForm<TConfigureFieldsFormSchema>({
    defaultValues: {
      fields: defaultValues?.fields ?? [],
    },
  });

  const { control, handleSubmit } = form;

  const onFormSubmit = handleSubmit(onSubmit);

  const {
    append,
    remove,
    update,
    fields: localFields,
  } = useFieldArray({
    control: control,
    name: 'fields',
  });

  const highestPageNumber = Math.max(...localFields.map((field) => field.pageNumber));

  const onFieldCopy = useCallback(
    (event?: KeyboardEvent | null, options?: { duplicate?: boolean; duplicateAll?: boolean }) => {
      const { duplicate = false, duplicateAll = false } = options ?? {};

      if (lastActiveField) {
        event?.preventDefault();

        if (duplicate) {
          const newField: TConfigureFieldsFormSchema['fields'][0] = {
            ...structuredClone(lastActiveField),
            nativeId: undefined,
            formId: nanoid(12),
            signerEmail: selectedRecipient?.email ?? lastActiveField.signerEmail,
            recipientId: selectedRecipient?.id ?? lastActiveField.recipientId,
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

            const newField: TConfigureFieldsFormSchema['fields'][0] = {
              ...structuredClone(lastActiveField),
              nativeId: undefined,
              formId: nanoid(12),
              signerEmail: selectedRecipient?.email ?? lastActiveField.signerEmail,
              recipientId: selectedRecipient?.id ?? lastActiveField.recipientId,
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
    [append, lastActiveField, selectedRecipient?.email, selectedRecipient?.id, toast],
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
          signerEmail: selectedRecipient?.email ?? copiedField.signerEmail,
          recipientId: selectedRecipient?.id ?? copiedField.recipientId,
          pageX: copiedField.pageX + 3,
          pageY: copiedField.pageY + 3,
        });
      }
    },
    [append, fieldClipboard, selectedRecipient?.email, selectedRecipient?.id],
  );

  useHotkeys(['ctrl+c', 'meta+c'], (evt) => onFieldCopy(evt));
  useHotkeys(['ctrl+v', 'meta+v'], (evt) => onFieldPaste(evt));
  useHotkeys(['ctrl+d', 'meta+d'], (evt) => onFieldCopy(evt, { duplicate: true }));

  const onMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!selectedField) return;

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
    [isWithinPageBounds, selectedField],
  );

  const onMouseClick = useCallback(
    (event: MouseEvent) => {
      if (!selectedField || !selectedRecipient) {
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
        type: selectedField,
        pageNumber,
        pageX,
        pageY,
        pageWidth: fieldPageWidth,
        pageHeight: fieldPageHeight,
        recipientId: selectedRecipient.id,
        signerEmail: selectedRecipient.email,
        fieldMeta: undefined,
      };

      append(field);

      // Automatically open advanced settings for field types that need configuration
      if (ADVANCED_FIELD_TYPES_WITH_OPTIONAL_SETTING.includes(selectedField)) {
        setCurrentField(field);
        setShowAdvancedSettings(true);
      }

      setSelectedField(null);
    },
    [append, getPage, isWithinPageBounds, selectedField, selectedRecipient],
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

  const handleUpdateFieldMeta = useCallback(
    (formId: string, fieldMeta: TFieldMetaSchema) => {
      const fieldIndex = localFields.findIndex((field) => field.formId === formId);

      if (fieldIndex !== -1) {
        const parsedFieldMeta = ZFieldMetaSchema.parse(fieldMeta);

        update(fieldIndex, {
          ...localFields[fieldIndex],
          fieldMeta: parsedFieldMeta,
        });
      }
    },
    [localFields, update],
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

  // Close drawer when a field is selected on mobile
  useEffect(() => {
    if (isMobile && selectedField) {
      setIsDrawerOpen(false);
    }
  }, [isMobile, selectedField]);

  return (
    <>
      <div className="grid w-full grid-cols-12 gap-4">
        {/* Desktop sidebar */}
        {!isMobile && (
          <div className="order-2 col-span-12 md:order-1 md:col-span-4">
            <div className="sticky top-4 max-h-[calc(100vh-2rem)] rounded-lg border border-border bg-widget p-4 pb-6">
              <h2 className="mb-1 text-lg font-medium">
                <Trans>Configure Fields</Trans>
              </h2>

              <p className="mb-6 text-sm text-muted-foreground">
                <Trans>Configure the fields you want to place on the document.</Trans>
              </p>

              <RecipientSelector
                selectedRecipient={selectedRecipient}
                onSelectedRecipientChange={setSelectedRecipient}
                recipients={recipients}
                className="w-full"
              />

              <hr className="my-6" />

              <div className="space-y-2">
                <FieldSelector
                  selectedField={selectedField}
                  onSelectedFieldChange={setSelectedField}
                  className="w-full"
                  disabled={!selectedRecipient}
                />
              </div>

              <div className="mt-6 flex gap-2">
                {onBack && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1"
                    loading={form.formState.isSubmitting}
                    onClick={() => onBack(form.getValues())}
                  >
                    <Trans>Back</Trans>
                  </Button>
                )}

                <Button
                  className="flex-1"
                  type="button"
                  loading={form.formState.isSubmitting}
                  disabled={!form.formState.isValid}
                  onClick={async () => onFormSubmit()}
                >
                  <Trans>Save</Trans>
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className={cn('order-1 col-span-12 md:order-2', !isMobile && 'md:col-span-8')}>
          <div className="relative">
            {selectedField && (
              <div
                className={cn(
                  'dark:text-muted-background pointer-events-none fixed z-50 flex cursor-pointer flex-col items-center justify-center bg-white text-muted-foreground transition duration-200 [container-type:size]',
                  selectedRecipientStyles.base,
                  {
                    '-rotate-6 scale-90 opacity-50 dark:bg-black/20': !isFieldWithinBounds,
                    'dark:text-black/60': isFieldWithinBounds,
                  },
                  selectedField === 'SIGNATURE' && 'font-signature',
                )}
                style={{
                  top: coords.y,
                  left: coords.x,
                  height: fieldBounds.current.height,
                  width: fieldBounds.current.width,
                }}
              >
                <span className="text-[clamp(0.425rem,25cqw,0.825rem)]">
                  {_(FRIENDLY_FIELD_TYPE[selectedField])}
                </span>
              </div>
            )}

            <Form {...form}>
              <div>
                <PDFViewerLazy
                  presignToken={presignToken}
                  overrideData={normalizedDocumentData}
                  envelopeItem={normalizedEnvelopeItem}
                  token={undefined}
                  version="signed"
                />

                <ElementVisible
                  target={`${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${highestPageNumber}"]`}
                >
                  {localFields.map((field, index) => {
                    const recipientIndex = recipients.findIndex((r) => r.id === field.recipientId);

                    return (
                      <FieldItem
                        key={field.formId}
                        field={field}
                        minHeight={MIN_HEIGHT_PX}
                        minWidth={MIN_WIDTH_PX}
                        defaultHeight={DEFAULT_HEIGHT_PX}
                        defaultWidth={DEFAULT_WIDTH_PX}
                        onResize={(node) => onFieldResize(node, index)}
                        onMove={(node) => onFieldMove(node, index)}
                        onRemove={() => remove(index)}
                        onDuplicate={() => onFieldCopy(null, { duplicate: true })}
                        onDuplicateAllPages={() => onFieldCopy(null, { duplicateAll: true })}
                        onFocus={() => setLastActiveField(field)}
                        onBlur={() => setLastActiveField(null)}
                        onAdvancedSettings={() => {
                          setCurrentField(field);
                          setShowAdvancedSettings(true);
                        }}
                        recipientIndex={recipientIndex}
                        active={activeFieldId === field.formId}
                        onFieldActivate={() => setActiveFieldId(field.formId)}
                        onFieldDeactivate={() => setActiveFieldId(null)}
                        disabled={selectedRecipient?.id !== field.recipientId}
                      />
                    );
                  })}
                </ElementVisible>
              </div>
            </Form>
          </div>
        </div>
      </div>

      {/* Mobile Floating Action Bar and Drawer */}
      {isMobile && (
        <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <SheetTrigger asChild>
            <div className="fixed bottom-6 left-6 right-6 z-50 flex items-center justify-between gap-2 rounded-lg border border-border bg-widget p-4">
              <span className="text-lg font-medium">
                <Trans>Configure Fields</Trans>
              </span>

              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground"
              >
                <ChevronsUpDown className="h-6 w-6" />
              </button>
            </div>
          </SheetTrigger>

          <SheetContent
            position="bottom"
            size="xl"
            className="h-fit max-h-[80vh] overflow-y-auto rounded-t-xl bg-widget p-4"
          >
            <h2 className="mb-1 text-lg font-medium">
              <Trans>Configure Fields</Trans>
            </h2>

            <p className="mb-6 text-sm text-muted-foreground">
              <Trans>Configure the fields you want to place on the document.</Trans>
            </p>

            <RecipientSelector
              selectedRecipient={selectedRecipient}
              onSelectedRecipientChange={setSelectedRecipient}
              recipients={recipients}
              className="w-full"
            />

            <hr className="my-6" />

            <div className="space-y-2">
              <FieldSelector
                selectedField={selectedField}
                onSelectedFieldChange={(field) => {
                  setSelectedField(field);
                  if (field) {
                    setIsDrawerOpen(false);
                  }
                }}
                className="w-full"
                disabled={!selectedRecipient}
              />
            </div>

            <div className="mt-6 flex gap-2">
              {onBack && (
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  loading={form.formState.isSubmitting}
                  onClick={() => onBack(form.getValues())}
                >
                  <Trans>Back</Trans>
                </Button>
              )}

              <Button
                className="flex-1"
                type="button"
                loading={form.formState.isSubmitting}
                disabled={!form.formState.isValid}
                onClick={async () => onFormSubmit()}
              >
                <Trans>Save</Trans>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}

      <FieldAdvancedSettingsDrawer
        isOpen={showAdvancedSettings}
        onOpenChange={setShowAdvancedSettings}
        currentField={currentField}
        fields={localFields}
        onFieldUpdate={handleUpdateFieldMeta}
      />
    </>
  );
};
