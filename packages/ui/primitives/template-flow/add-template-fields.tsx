'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Caveat } from 'next/font/google';

import { ChevronsUpDown } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';

import { getBoundingClientRect } from '@documenso/lib/client-only/get-bounding-client-rect';
import { useDocumentElement } from '@documenso/lib/client-only/hooks/use-document-element';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
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
  DocumentFlowFormContainerStep,
} from '@documenso/ui/primitives/document-flow/document-flow-root';
import { FieldItem } from '@documenso/ui/primitives/document-flow/field-item';
import type { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import { FRIENDLY_FIELD_TYPE } from '@documenso/ui/primitives/document-flow/types';
import { Popover, PopoverContent, PopoverTrigger } from '@documenso/ui/primitives/popover';

import { useStep } from '../stepper';
// import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';
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

export type AddTemplateFieldsFormProps = {
  documentFlow: DocumentFlowStep;
  hideRecipients?: boolean;
  recipients: Recipient[];
  fields: Field[];
  onSubmit: (_data: TAddTemplateFieldsFormSchema) => void;
};

export const AddTemplateFieldsFormPartial = ({
  documentFlow,
  hideRecipients = false,
  recipients,
  fields,
  onSubmit,
}: AddTemplateFieldsFormProps) => {
  const { isWithinPageBounds, getFieldPosition, getPage } = useDocumentElement();

  const { currentStep, totalSteps, previousStep } = useStep();

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
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

  return (
    <>
      <DocumentFlowFormContainerContent>
        <div className="flex flex-col">
          {selectedField && (
            <Card
              className={cn(
                'bg-background pointer-events-none fixed z-50 cursor-pointer transition-opacity',
                {
                  'border-primary': isFieldWithinBounds,
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
              <CardContent className="text-foreground flex h-full w-full items-center justify-center p-2">
                {FRIENDLY_FIELD_TYPE[selectedField]}
              </CardContent>
            </Card>
          )}

          {localFields.map((field, index) => (
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
            />
          ))}

          {!hideRecipients && (
            <Popover open={showRecipientsSelector} onOpenChange={setShowRecipientsSelector}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className="bg-background text-muted-foreground mb-12 justify-between font-normal"
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
                <Command>
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
            <div className="grid grid-cols-2 gap-x-4 gap-y-8">
              <button
                type="button"
                className="group h-full w-full"
                disabled={!selectedSigner}
                onClick={() => setSelectedField(FieldType.SIGNATURE)}
                onMouseDown={() => setSelectedField(FieldType.SIGNATURE)}
                data-selected={selectedField === FieldType.SIGNATURE ? true : undefined}
              >
                <Card className="group-data-[selected]:border-documenso h-full w-full cursor-pointer group-disabled:opacity-50">
                  <CardContent className="flex flex-col items-center justify-center px-6 py-4">
                    <p
                      className={cn(
                        'text-muted-foreground group-data-[selected]:text-foreground w-full truncate text-3xl font-medium',
                        fontCaveat.className,
                      )}
                    >
                      {selectedSigner?.name || 'Signature'}
                    </p>

                    <p className="text-muted-foreground mt-2 text-center text-xs">Signature</p>
                  </CardContent>
                </Card>
              </button>

              <button
                type="button"
                className="group h-full w-full"
                disabled={!selectedSigner}
                onClick={() => setSelectedField(FieldType.EMAIL)}
                onMouseDown={() => setSelectedField(FieldType.EMAIL)}
                data-selected={selectedField === FieldType.EMAIL ? true : undefined}
              >
                <Card className="group-data-[selected]:border-documenso h-full w-full cursor-pointer group-disabled:opacity-50">
                  <CardContent className="flex flex-col items-center justify-center px-6 py-4">
                    <p
                      className={cn(
                        'text-muted-foreground group-data-[selected]:text-foreground text-xl font-medium',
                      )}
                    >
                      {'Email'}
                    </p>

                    <p className="text-muted-foreground mt-2 text-xs">Email</p>
                  </CardContent>
                </Card>
              </button>

              <button
                type="button"
                className="group h-full w-full"
                disabled={!selectedSigner}
                onClick={() => setSelectedField(FieldType.NAME)}
                onMouseDown={() => setSelectedField(FieldType.NAME)}
                data-selected={selectedField === FieldType.NAME ? true : undefined}
              >
                <Card className="group-data-[selected]:border-documenso h-full w-full cursor-pointer group-disabled:opacity-50">
                  <CardContent className="flex flex-col items-center justify-center px-6 py-4">
                    <p
                      className={cn(
                        'text-muted-foreground group-data-[selected]:text-foreground text-xl font-medium',
                      )}
                    >
                      {'Name'}
                    </p>

                    <p className="text-muted-foreground mt-2 text-xs">Name</p>
                  </CardContent>
                </Card>
              </button>

              <button
                type="button"
                className="group h-full w-full"
                disabled={!selectedSigner}
                onClick={() => setSelectedField(FieldType.DATE)}
                onMouseDown={() => setSelectedField(FieldType.DATE)}
                data-selected={selectedField === FieldType.DATE ? true : undefined}
              >
                <Card className="group-data-[selected]:border-documenso h-full w-full cursor-pointer group-disabled:opacity-50">
                  <CardContent className="flex flex-col items-center justify-center px-6 py-4">
                    <p
                      className={cn(
                        'text-muted-foreground group-data-[selected]:text-foreground text-xl font-medium',
                      )}
                    >
                      {'Date'}
                    </p>

                    <p className="text-muted-foreground mt-2 text-xs">Date</p>
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
                <Card className="group-data-[selected]:border-documenso h-full w-full cursor-pointer group-disabled:opacity-50">
                  <CardContent className="flex flex-col items-center justify-center px-6 py-4">
                    <p
                      className={cn(
                        'text-muted-foreground group-data-[selected]:text-foreground text-xl font-medium',
                      )}
                    >
                      {'Text'}
                    </p>

                    <p className="text-muted-foreground mt-2 text-xs">Custom Text</p>
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
  );
};
