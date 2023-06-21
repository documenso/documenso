'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Caveat } from 'next/font/google';

import { Check, ChevronsUpDown } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Control, FieldErrors, UseFormWatch, useFieldArray } from 'react-hook-form';

import { FieldType } from '@documenso/prisma/client';
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

import { PDF_VIEWER_PAGE_SELECTOR } from '~/components/(dashboard)/pdf-viewer/types';

import { FieldItem } from './field-item';
import { FRIENDLY_FIELD_TYPE, TEditDocumentFormSchema } from './types';

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
  className?: string;
  control: Control<TEditDocumentFormSchema>;
  watch: UseFormWatch<TEditDocumentFormSchema>;
  errors: FieldErrors<TEditDocumentFormSchema>;
  isSubmitting: boolean;
};

export const AddFieldsFormPartial = ({
  className,
  control: control,
  watch,
  errors: _errors,
  isSubmitting: _isSubmitting,
}: AddFieldsFormProps) => {
  const signers = watch('signers');
  const fields = watch('fields');

  const { append, remove, update } = useFieldArray({
    control,
    name: 'fields',
  });

  const [selectedSigner, setSelectedSigner] = useState(() => signers[0]);

  const [selectedField, setSelectedField] = useState<FieldType | null>(null);

  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({
    x: 0,
    y: 0,
  });

  const fieldBounds = useRef({
    height: 0,
    width: 0,
  });

  const isWithinPageBounds = useCallback((event: MouseEvent) => {
    if (!(event.target instanceof HTMLElement)) {
      return false;
    }

    const target = event.target;
    const $page =
      target.closest(PDF_VIEWER_PAGE_SELECTOR) ?? target.querySelector(PDF_VIEWER_PAGE_SELECTOR);

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
      if (!selectedField) {
        return;
      }

      if (!(event.target instanceof HTMLElement)) {
        return;
      }

      const target = event.target;

      const $page =
        target.closest<HTMLElement>(PDF_VIEWER_PAGE_SELECTOR) ??
        target.querySelector<HTMLElement>(PDF_VIEWER_PAGE_SELECTOR);

      if (!$page || !isWithinPageBounds(event)) {
        return;
      }

      const { height, width } = $page.getBoundingClientRect();

      const top = $page.offsetTop;
      const left = $page.offsetLeft;

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
    [append, isWithinPageBounds, selectedField, selectedSigner.email],
  );

  const onFieldResize = useCallback(
    (node: HTMLElement, index: number) => {
      const field = fields[index];

      const $page = document.querySelector<HTMLElement>(
        `${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.pageNumber}"]`,
      );

      if (!$page) {
        return;
      }

      const { height: pageHeight, width: pageWidth } = $page.getBoundingClientRect();

      const pageTop = $page.offsetTop;
      const pageLeft = $page.offsetLeft;

      let { top: nodeTop, left: nodeLeft } = node.getBoundingClientRect();
      const { height, width } = node.getBoundingClientRect();

      nodeTop += window.scrollY;
      nodeLeft += window.scrollX;

      // Calculate width and height as a percentage of the page width and height
      const newWidth = (width / pageWidth) * 100;
      const newHeight = (height / pageHeight) * 100;

      // Calculate the new position as a percentage of the page width and height
      const newX = ((nodeLeft - pageLeft) / pageWidth) * 100;
      const newY = ((nodeTop - pageTop) / pageHeight) * 100;

      update(index, {
        ...field,
        pageX: newX,
        pageY: newY,
        pageWidth: newWidth,
        pageHeight: newHeight,
      });
    },
    [fields, update],
  );

  const onFieldMove = useCallback(
    (node: HTMLElement, index: number) => {
      const field = fields[index];

      const $page = document.querySelector(
        `${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.pageNumber}"]`,
      );

      if (!$page || !($page instanceof HTMLElement)) {
        return;
      }

      const { height: pageHeight, width: pageWidth } = $page.getBoundingClientRect();

      const pageTop = $page.offsetTop;
      const pageLeft = $page.offsetLeft;

      let { top: nodeTop, left: nodeLeft } = node.getBoundingClientRect();

      nodeTop += window.scrollY;
      nodeLeft += window.scrollX;

      // Calculate the new position as a percentage of the page width and height
      const newX = ((nodeLeft - pageLeft) / pageWidth) * 100;
      const newY = ((nodeTop - pageTop) / pageHeight) * 100;

      update(index, {
        ...field,
        pageX: newX,
        pageY: newY,
      });
    },
    [fields, update],
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
    const $page = document.querySelector(PDF_VIEWER_PAGE_SELECTOR);

    if (!$page) {
      return;
    }

    const { height, width } = $page.getBoundingClientRect();

    fieldBounds.current = {
      height: Math.max(height * (DEFAULT_HEIGHT_PERCENT / 100), MIN_HEIGHT_PX),
      width: Math.max(width * (DEFAULT_WIDTH_PERCENT / 100), MIN_WIDTH_PX),
    };
  }, []);

  return (
    <div className={cn('flex flex-col', className)}>
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

      {fields.map((field, index) => (
        <FieldItem
          key={index}
          field={field}
          disabled={selectedSigner.email !== field.signerEmail}
          minHeight={fieldBounds.current.height}
          minWidth={fieldBounds.current.width}
          passive={visible && !!selectedField}
          onResize={(options) => onFieldResize(options, index)}
          onMove={(options) => onFieldMove(options, index)}
          onRemove={() => remove(index)}
        />
      ))}

      <h3 className="text-2xl font-semibold">Add Fields</h3>

      <p className="text-muted-foreground mt-2 text-sm">
        Add all relevant fields for each recipient.
      </p>

      <hr className="mb-8 mt-4" />

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            className="bg-background text-muted-foreground justify-between font-normal"
          >
            {selectedSigner.name && (
              <span>
                {selectedSigner.name} ({selectedSigner.email})
              </span>
            )}

            {!selectedSigner.name && <span>{selectedSigner.email}</span>}

            <ChevronsUpDown className="ml-2 h-4 w-4" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="p-0" align="start">
          <Command>
            <CommandInput />
            <CommandEmpty />

            <CommandGroup>
              {signers.map((signer, index) => (
                <CommandItem key={index} onSelect={() => setSelectedSigner(signer)}>
                  <Check
                    aria-hidden={signer !== selectedSigner}
                    className={cn('mr-2 h-4 w-4', {
                      'opacity-0': signer !== selectedSigner,
                      'opacity-100': signer === selectedSigner,
                    })}
                  />
                  {signer.name && (
                    <span>
                      {signer.name} ({signer.email})
                    </span>
                  )}

                  {!signer.name && <span>{signer.email}</span>}
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
            onClick={() => setSelectedField(FieldType.SIGNATURE)}
            data-selected={selectedField === FieldType.SIGNATURE ? true : undefined}
          >
            <Card className="group-data-[selected]:border-documenso h-full w-full cursor-pointer">
              <CardContent className="flex flex-col items-center justify-center px-6 py-4">
                <p
                  className={cn(
                    'text-muted-foreground group-data-[selected]:text-foreground text-3xl font-medium',
                    fontCaveat.className,
                  )}
                >
                  {selectedSigner.name || 'Signature'}
                </p>

                <p className="text-muted-foreground mt-2 text-center text-xs">Signature</p>
              </CardContent>
            </Card>
          </button>

          <button
            type="button"
            className="group h-full w-full"
            onClick={() => setSelectedField(FieldType.EMAIL)}
            data-selected={selectedField === FieldType.EMAIL ? true : undefined}
          >
            <Card className="group-data-[selected]:border-documenso h-full w-full cursor-pointer">
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
            onClick={() => setSelectedField(FieldType.NAME)}
            data-selected={selectedField === FieldType.NAME ? true : undefined}
          >
            <Card className="group-data-[selected]:border-documenso h-full w-full cursor-pointer">
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
            onClick={() => setSelectedField(FieldType.DATE)}
            data-selected={selectedField === FieldType.DATE ? true : undefined}
          >
            <Card className="group-data-[selected]:border-documenso h-full w-full cursor-pointer">
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
  );
};
