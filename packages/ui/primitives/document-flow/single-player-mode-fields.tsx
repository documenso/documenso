'use client';

import React, { useRef } from 'react';

import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { match } from 'ts-pattern';

import { useElementScaleSize } from '@documenso/lib/client-only/hooks/use-element-scale-size';
import { useFieldPageCoords } from '@documenso/lib/client-only/hooks/use-field-page-coords';
import {
  DEFAULT_HANDWRITING_FONT_SIZE,
  DEFAULT_STANDARD_FONT_SIZE,
  MIN_HANDWRITING_FONT_SIZE,
  MIN_STANDARD_FONT_SIZE,
} from '@documenso/lib/constants/pdf';
import { Field, FieldType } from '@documenso/prisma/client';
import { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';

export type FieldContainerPortalProps = {
  field: FieldWithSignature;
  className?: string;
  children: React.ReactNode;
};

export type SinglePlayerModeFieldContainerProps = {
  field: FieldWithSignature;
  children: React.ReactNode;
  validateUninsertedField?: boolean;
};

export type SinglePlayerModeFieldProps<T> = {
  field: T;
  onClick?: () => void;
  validateUninsertedField?: boolean;
};

export function FieldContainerPortal({
  field,
  children,
  className = '',
}: FieldContainerPortalProps) {
  const coords = useFieldPageCoords(field);

  return createPortal(
    <div
      className={cn('absolute', className)}
      style={{
        top: `${coords.y}px`,
        left: `${coords.x}px`,
        height: `${coords.height}px`,
        width: `${coords.width}px`,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export function SinglePlayerModeFieldCardContainer({
  field,
  children,
  validateUninsertedField = false,
}: SinglePlayerModeFieldContainerProps) {
  return (
    <FieldContainerPortal field={field}>
      <motion.div className="h-full w-full" animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <Card
          id={`field-${field.id}`}
          className={cn('bg-background relative z-20 h-full w-full transition-all', {
            'border-orange-300 ring-1 ring-orange-300': !field.inserted && validateUninsertedField,
          })}
          data-inserted={field.inserted ? 'true' : 'false'}
        >
          <CardContent className="text-foreground hover:shadow-primary-foreground group flex h-full w-full flex-col items-center justify-center p-2">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={field.inserted ? 'inserted' : 'not-inserted'}
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.2,
                  ease: 'easeIn',
                }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </FieldContainerPortal>
  );
}

export function SinglePlayerModeSignatureField({
  field,
  validateUninsertedField,
  onClick,
}: SinglePlayerModeFieldProps<FieldWithSignature>) {
  const fontVariable = '--font-signature';
  const fontVariableValue = getComputedStyle(document.documentElement).getPropertyValue(
    fontVariable,
  );

  const minFontSize = MIN_HANDWRITING_FONT_SIZE;
  const maxFontSize = DEFAULT_HANDWRITING_FONT_SIZE;

  if (!isSignatureFieldType(field.type)) {
    throw new Error('Invalid field type');
  }

  const $paragraphEl = useRef<HTMLParagraphElement>(null);

  const { height, width } = useFieldPageCoords(field);

  const scalingFactor = useElementScaleSize(
    {
      height,
      width,
    },
    $paragraphEl,
    maxFontSize,
    fontVariableValue,
  );

  const fontSize = maxFontSize * scalingFactor;

  const insertedBase64Signature = field.inserted && field.Signature?.signatureImageAsBase64;
  const insertedTypeSignature = field.inserted && field.Signature?.typedSignature;

  return (
    <SinglePlayerModeFieldCardContainer
      validateUninsertedField={validateUninsertedField}
      field={field}
    >
      {insertedBase64Signature ? (
        <img
          src={insertedBase64Signature}
          alt="Your signature"
          className="h-full w-full object-contain"
        />
      ) : insertedTypeSignature ? (
        <p
          ref={$paragraphEl}
          style={{
            fontSize: `clamp(${minFontSize}px, ${fontSize}px, ${maxFontSize}px)`,
            fontFamily: `var(${fontVariable})`,
          }}
          className="font-signature"
        >
          {insertedTypeSignature}
        </p>
      ) : (
        <button
          onClick={() => onClick?.()}
          className="group-hover:text-primary text-muted-foreground absolute inset-0 duration-200"
        >
          Signature
        </button>
      )}
    </SinglePlayerModeFieldCardContainer>
  );
}

export function SinglePlayerModeCustomTextField({
  field,
  validateUninsertedField,
  onClick,
}: SinglePlayerModeFieldProps<Field>) {
  const fontVariable = '--font-sans';
  const fontVariableValue = getComputedStyle(document.documentElement).getPropertyValue(
    fontVariable,
  );

  const minFontSize = MIN_STANDARD_FONT_SIZE;
  const maxFontSize = DEFAULT_STANDARD_FONT_SIZE;

  if (isSignatureFieldType(field.type)) {
    throw new Error('Invalid field type');
  }

  const $paragraphEl = useRef<HTMLParagraphElement>(null);

  const { height, width } = useFieldPageCoords(field);

  const scalingFactor = useElementScaleSize(
    {
      height,
      width,
    },
    $paragraphEl,
    maxFontSize,
    fontVariableValue,
  );

  const fontSize = maxFontSize * scalingFactor;

  return (
    <SinglePlayerModeFieldCardContainer
      validateUninsertedField={validateUninsertedField}
      field={field}
    >
      {field.inserted ? (
        <p
          ref={$paragraphEl}
          style={{
            fontSize: `clamp(${minFontSize}px, ${fontSize}px, ${maxFontSize}px)`,
            fontFamily: `var(${fontVariable})`,
          }}
        >
          {field.customText}
        </p>
      ) : (
        <button
          onClick={() => onClick?.()}
          className="group-hover:text-primary text-muted-foreground absolute inset-0 text-lg duration-200"
        >
          {match(field.type)
            .with(FieldType.DATE, () => 'Date')
            .with(FieldType.NAME, () => 'Name')
            .with(FieldType.EMAIL, () => 'Email')
            .with(FieldType.SIGNATURE, FieldType.FREE_SIGNATURE, () => 'Signature')
            .otherwise(() => '')}
        </button>
      )}
    </SinglePlayerModeFieldCardContainer>
  );
}

const isSignatureFieldType = (fieldType: Field['type']) =>
  fieldType === FieldType.SIGNATURE || fieldType === FieldType.FREE_SIGNATURE;
