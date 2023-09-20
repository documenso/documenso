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
}: SinglePlayerModeFieldContainerProps) {
  return (
    <FieldContainerPortal field={field}>
      <motion.div className="h-full w-full" animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <Card
          className="bg-background relative z-20 h-full w-full"
          data-inserted={field.inserted ? 'true' : 'false'}
        >
          <CardContent
            className={cn(
              'text-foreground hover:shadow-primary-foreground group flex h-full w-full flex-col items-center justify-center p-2',
            )}
          >
            {children}
          </CardContent>
        </Card>
      </motion.div>
    </FieldContainerPortal>
  );
}

export function SinglePlayerModeSignatureField({ field }: { field: FieldWithSignature }) {
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
    <SinglePlayerModeFieldCardContainer field={field}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={
            (insertedBase64Signature && 'base64Signature') ||
            (insertedTypeSignature && 'typedSignature') ||
            'not-inserted'
          }
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            transition: {
              duration: 0.3,
            },
          }}
          exit={{ opacity: 0 }}
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
            <p className="group-hover:text-primary text-muted-foreground duration-200">Signature</p>
          )}
        </motion.div>
      </AnimatePresence>
    </SinglePlayerModeFieldCardContainer>
  );
}

export function SinglePlayerModeCustomTextField({ field }: { field: Field }) {
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
    <SinglePlayerModeFieldCardContainer key="not-inserted" field={field}>
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
        <p className="group-hover:text-primary text-muted-foreground text-lg duration-200">
          {match(field.type)
            .with(FieldType.DATE, () => 'Date')
            .with(FieldType.NAME, () => 'Name')
            .with(FieldType.EMAIL, () => 'Email')
            .with(FieldType.SIGNATURE, FieldType.FREE_SIGNATURE, () => 'Signature')
            .otherwise(() => '')}
        </p>
      )}
    </SinglePlayerModeFieldCardContainer>
  );
}

const isSignatureFieldType = (fieldType: Field['type']) =>
  fieldType === FieldType.SIGNATURE || fieldType === FieldType.FREE_SIGNATURE;
