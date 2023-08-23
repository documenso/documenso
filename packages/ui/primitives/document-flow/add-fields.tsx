'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Caveat } from 'next/font/google';

import { Check, ChevronsUpDown, Info } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useFieldArray, useForm } from 'react-hook-form';

import { getBoundingClientRect } from '@documenso/lib/client-only/get-bounding-client-rect';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { Document, Field, FieldType, Recipient, SendStatus } from '@documenso/prisma/client';
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
import { Popover, PopoverContent, PopoverTrigger } from '@documenso/ui/primitives/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

import { TAddFieldsFormSchema } from './add-fields.types';
import {
  DocumentFlowFormContainer,
  DocumentFlowFormContainerActions,
  DocumentFlowFormContainerContent,
  DocumentFlowFormContainerFooter,
  DocumentFlowFormContainerStep,
} from './document-flow-root';
import { FieldItem } from './field-item';
import { FRIENDLY_FIELD_TYPE } from './types';

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

export type AddFieldsFormProps = {
  recipients: Recipient[];
  fields: Field[];
  document: Document;
  onContinue?: () => void;
  onGoBack?: () => void;
  onSubmit: (_data: TAddFieldsFormSchema) => void;
};

export const AddFieldsFormPartial = ({
  recipients,
  fields,
  onGoBack,
  onSubmit,
}: AddFieldsFormProps) => {
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
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
      })),
    },
  });

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

  const hasSelectedSignerBeenSent = selectedSigner?.sendStatus === SendStatus.SENT;

  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({
    x: 0,
    y: 0,
  });

  const fieldBounds = useRef({
    height: 0,
    width: 0,
  });

  /**
   * Given a mouse event, find the nearest pdf page element.
   */
  const getPage = (event: MouseEvent) => {
    if (!(event.target instanceof HTMLElement)) {
      return null;
    }

    const target = event.target;

    const $page =
      target.closest<HTMLElement>(PDF_VIEWER_PAGE_SELECTOR) ??
      target.querySelector<HTMLElement>(PDF_VIEWER_PAGE_SELECTOR);

    if (!$page) {
      return null;
    }

    return $page;
  };

  /**
   * Provided a page and a field, calculate the position of the field
   * as a percentage of the page width and height.
   */
  const getFieldPosition = (page: HTMLElement, field: HTMLElement) => {
    const {
      top: pageTop,
      left: pageLeft,
      height: pageHeight,
      width: pageWidth,
    } = getBoundingClientRect(page);

    const {
      top: fieldTop,
      left: fieldLeft,
      height: fieldHeight,
      width: fieldWidth,
    } = getBoundingClientRect(field);

    return {
      x: ((fieldLeft - pageLeft) / pageWidth) * 100,
      y: ((fieldTop - pageTop) / pageHeight) * 100,
      width: (fieldWidth / pageWidth) * 100,
      height: (fieldHeight / pageHeight) * 100,
    };
  };

  /**
   * Given a mouse event, determine if the mouse is within the bounds of the
   * nearest pdf page element.
   */
  const isWithinPageBounds = useCallback((event: MouseEvent) => {
    const $page = getPage(event);

    if (!$page) {
      return false;
    }

    const { top, left, height, width } = $page.getBoundingClientRect();

    if (event.clientY > top + height || event.clientY < top) {
      return false;
    }

    if (event.clientX > left + width || event.clientX < left) {
      return false;
    }

    return true;
  }, []);

  const onMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isWithinPageBounds(event)) {
        setVisible(false);
        return;
      }

      setVisible(true);
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

      const $page = getPage(event);

      if (!$page || !isWithinPageBounds(event)) {
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
      });

      setVisible(false);
      setSelectedField(null);
    },
    [append, isWithinPageBounds, selectedField, selectedSigner],
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
    [localFields, update],
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
    [localFields, update],
  );

  useEffect(() => {
    if (selectedField) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('click', onMouseClick);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('click', onMouseClick);
    };
  }, [onMouseClick, onMouseMove, selectedField]);

  useEffect(() => {
    const $page = window.document.querySelector(PDF_VIEWER_PAGE_SELECTOR);

    if (!$page) {
      return;
    }

    const { height, width } = $page.getBoundingClientRect();

    fieldBounds.current = {
      height: Math.max(height * (DEFAULT_HEIGHT_PERCENT / 100), MIN_HEIGHT_PX),
      width: Math.max(width * (DEFAULT_WIDTH_PERCENT / 100), MIN_WIDTH_PX),
    };
  }, []);

  useEffect(() => {
    setSelectedSigner(recipients.find((r) => r.sendStatus !== SendStatus.SENT) ?? recipients[0]);
  }, [recipients]);

  return (
    <DocumentFlowFormContainer>
      <DocumentFlowFormContainerContent
        title="Add Fields"
        description="Add all relevant fields for each recipient."
      >
        <div className="flex flex-col">
          {selectedField && visible && (
            <Card
              className="border-primary pointer-events-none fixed z-50 cursor-pointer bg-white"
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
              disabled={selectedSigner?.email !== field.signerEmail || hasSelectedSignerBeenSent}
              minHeight={fieldBounds.current.height}
              minWidth={fieldBounds.current.width}
              passive={visible && !!selectedField}
              onResize={(options) => onFieldResize(options, index)}
              onMove={(options) => onFieldMove(options, index)}
              onRemove={() => remove(index)}
            />
          ))}

          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                className="bg-background text-muted-foreground justify-between font-normal"
              >
                {selectedSigner?.email && (
                  <span className="flex-1 truncate text-left">
                    {selectedSigner?.email} ({selectedSigner?.email})
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
                <CommandEmpty />

                <CommandGroup>
                  {recipients.map((recipient, index) => (
                    <CommandItem
                      key={index}
                      className={cn({
                        'text-muted-foreground': recipient.sendStatus === SendStatus.SENT,
                      })}
                      onSelect={() => setSelectedSigner(recipient)}
                    >
                      {recipient.sendStatus !== SendStatus.SENT ? (
                        <Check
                          aria-hidden={recipient !== selectedSigner}
                          className={cn('mr-2 h-4 w-4 flex-shrink-0', {
                            'opacity-0': recipient !== selectedSigner,
                            'opacity-100': recipient === selectedSigner,
                          })}
                        />
                      ) : (
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="mr-2 h-4 w-4" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            This document has already been sent to this recipient. You can no longer
                            edit this recipient.
                          </TooltipContent>
                        </Tooltip>
                      )}

                      {recipient.name && (
                        <span className="truncate" title={`${recipient.name} (${recipient.email})`}>
                          {recipient.name} ({recipient.email})
                        </span>
                      )}

                      {!recipient.name && (
                        <span className="truncate" title={recipient.email}>
                          {recipient.email}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>

          <div className="-mx-2 mt-8 flex-1 overflow-y-scroll px-2">
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8">
              <button
                type="button"
                className="group h-full w-full"
                disabled={!selectedSigner || selectedSigner?.sendStatus === SendStatus.SENT}
                onClick={() => setSelectedField(FieldType.SIGNATURE)}
                data-selected={selectedField === FieldType.SIGNATURE ? true : undefined}
              >
                <Card className="group-data-[selected]:border-documenso h-full w-full cursor-pointer group-disabled:opacity-50">
                  <CardContent className="flex flex-col items-center justify-center px-6 py-4">
                    <p
                      className={cn(
                        'text-muted-foreground group-data-[selected]:text-foreground text-3xl font-medium',
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
                disabled={!selectedSigner || selectedSigner?.sendStatus === SendStatus.SENT}
                onClick={() => setSelectedField(FieldType.EMAIL)}
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
                disabled={!selectedSigner || selectedSigner?.sendStatus === SendStatus.SENT}
                onClick={() => setSelectedField(FieldType.NAME)}
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
                disabled={!selectedSigner || selectedSigner?.sendStatus === SendStatus.SENT}
                onClick={() => setSelectedField(FieldType.DATE)}
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
            </div>
          </div>
        </div>
      </DocumentFlowFormContainerContent>

      <DocumentFlowFormContainerFooter>
        <DocumentFlowFormContainerStep title="Add Fields" step={2} maxStep={3} />

        <DocumentFlowFormContainerActions
          loading={isSubmitting}
          disabled={isSubmitting}
          onGoNextClick={() => handleSubmit(onSubmit)()}
          onGoBackClick={onGoBack}
        />
      </DocumentFlowFormContainerFooter>
    </DocumentFlowFormContainer>
  );
};
