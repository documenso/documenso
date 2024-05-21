'use client';

import React, { useRef } from 'react';

import { Caveat } from 'next/font/google';

import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, CheckSquare, ChevronDown, Disc, Hash, Mail, Type, User } from 'lucide-react';
import { match } from 'ts-pattern';

import { useElementScaleSize } from '@documenso/lib/client-only/hooks/use-element-scale-size';
import { useFieldPageCoords } from '@documenso/lib/client-only/hooks/use-field-page-coords';
import {
  DEFAULT_HANDWRITING_FONT_SIZE,
  DEFAULT_STANDARD_FONT_SIZE,
  MIN_HANDWRITING_FONT_SIZE,
  MIN_STANDARD_FONT_SIZE,
} from '@documenso/lib/constants/pdf';
import type { Field } from '@documenso/prisma/client';
import { FieldType } from '@documenso/prisma/client';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';

import { FieldRootContainer } from '../../components/field/field';
import { cn } from '../../lib/utils';

const fontCaveat = Caveat({
  weight: ['500'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-caveat',
});

export type SinglePlayerModeFieldContainerProps = {
  field: FieldWithSignature;
  children: React.ReactNode;
};

export type SinglePlayerModeFieldProps<T> = {
  field: T;
  onClick?: () => void;
};

export function SinglePlayerModeFieldCardContainer({
  field,
  children,
}: SinglePlayerModeFieldContainerProps) {
  return (
    <FieldRootContainer field={field}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={field.inserted ? 'inserted' : 'not-inserted'}
          className="flex items-center justify-center p-2"
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
    </FieldRootContainer>
  );
}

export function SinglePlayerModeSignatureField({
  field,
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

  const { height, width } = useFieldPageCoords(field);

  const insertedBase64Signature = field.inserted && field.Signature?.signatureImageAsBase64;
  const insertedTypeSignature = field.inserted && field.Signature?.typedSignature;

  const scalingFactor = useElementScaleSize(
    {
      height,
      width,
    },
    insertedTypeSignature || '',
    maxFontSize,
    fontVariableValue,
  );

  const fontSize = maxFontSize * scalingFactor;

  return (
    <SinglePlayerModeFieldCardContainer field={field}>
      {insertedBase64Signature ? (
        <img
          src={insertedBase64Signature}
          alt="Your signature"
          className="h-full max-w-full object-contain dark:invert"
        />
      ) : insertedTypeSignature ? (
        <p
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
          className={
            cn('group-hover:text-primary absolute inset-0 h-full w-full duration-200', fontCaveat.className)
          }
        >
          <span className="text-muted-foreground truncate text-3xl font-medium ">Signature</span>
        </button>
      )}
    </SinglePlayerModeFieldCardContainer>
  );
}

export function SinglePlayerModeCustomTextField({
  field,
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
    field.customText,
    maxFontSize,
    fontVariableValue,
  );

  const fontSize = maxFontSize * scalingFactor;

  return (
    <>
      <SinglePlayerModeFieldCardContainer field={field}>
        {field.inserted ? (
          <p
            ref={$paragraphEl}
            style={{
              fontSize: `clamp(${minFontSize}px, ${fontSize}px, ${maxFontSize}px)`,
              fontFamily: `var(${fontVariable})`,
            }}
          >
            {field.customText ??
              (field.fieldMeta && typeof field.fieldMeta === 'object' && 'label' in field.fieldMeta
                ? field.fieldMeta.label
                : '')}
          </p>
        ) : (
          <button
            onClick={() => onClick?.()}
            className="group-hover:text-primary text-muted-foreground absolute inset-0 h-full w-full text-lg duration-200"
          >
            {match(field.type)
              .with(FieldType.DATE, () => (
                <div className="text-field-card-foreground flex items-center justify-center gap-x-1 text-xl font-light">
                  <CalendarDays /> Date
                </div>
              ))
              .with(FieldType.NAME, () => (
                <div className="text-field-card-foreground flex items-center justify-center gap-x-1 text-xl font-light">
                  <User /> Name
                </div>
              ))
              .with(FieldType.EMAIL, () => (
                <div className="text-field-card-foreground flex items-center justify-center gap-x-1 text-xl font-light">
                  <Mail /> Email
                </div>
              ))
              .with(FieldType.TEXT, () => (
                <div className="text-field-card-foreground flex items-center justify-center gap-x-1 text-xl font-light">
                  <Type /> Text
                </div>
              ))
              .with(FieldType.SIGNATURE, FieldType.FREE_SIGNATURE, () => (
                <div
                  className={cn(
                    'text-muted-foreground w-full truncate text-3xl font-medium',
                    fontCaveat.className,
                  )}
                >
                  Signature
                </div>
              ))
              .with(FieldType.NUMBER, () => (
                <div className="text-field-card-foreground flex items-center justify-center gap-x-1 text-xl font-light">
                  <Hash /> Number
                </div>
              ))
              .with(FieldType.CHECKBOX, () => (
                <div className="text-field-card-foreground flex items-center justify-center gap-x-1 text-xl font-light">
                  <CheckSquare /> Checkbox
                </div>
              ))
              .with(FieldType.RADIO, () => (
                <div className="text-field-card-foreground flex items-center justify-center gap-x-1 text-xl font-light">
                  <Disc /> Radio
                </div>
              ))
              .with(FieldType.DROPDOWN, () => (
                <div className="text-field-card-foreground flex items-center justify-center gap-x-1 text-xl font-light">
                  <ChevronDown /> Dropdown
                </div>
              ))
              .otherwise(() => '')}
          </button>
        )}
      </SinglePlayerModeFieldCardContainer>
    </>
  );
}

const isSignatureFieldType = (fieldType: Field['type']) =>
  fieldType === FieldType.SIGNATURE || fieldType === FieldType.FREE_SIGNATURE;
