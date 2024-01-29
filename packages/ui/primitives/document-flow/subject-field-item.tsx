'use client';

import { useCallback, useEffect, useState } from 'react';

import { createPortal } from 'react-dom';
import { Rnd } from 'react-rnd';

import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';

import { cn } from '../../lib/utils';
import { Card, CardContent } from '../card';
import { FRIENDLY_FIELD_TYPE } from './types';
import type { Prisma } from '.prisma/client';

type Field = Prisma.FieldGetPayload<null>;

export type FieldItemProps = {
  field: Field;
  recipients: Prisma.RecipientGetPayload<null>[];
};

export const SubjectFieldItem = ({ field, recipients }: FieldItemProps) => {
  const [coords, setCoords] = useState({
    pageX: Number(field.positionX),
    pageY: Number(field.positionY),
    pageHeight: Number(field.height),
    pageWidth: Number(field.width),
  });

  const signerEmail =
    recipients.find((recipient) => recipient.id === field.recipientId)?.email ?? '';

  const calculateCoords = useCallback(() => {
    const $page = document.querySelector<HTMLElement>(
      `${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.page}"]`,
    );

    if (!$page) {
      return;
    }

    const { height, width } = $page.getBoundingClientRect();

    const top = $page.getBoundingClientRect().top + window.scrollY;
    const left = $page.getBoundingClientRect().left + window.scrollX;

    // X and Y are percentages of the page's height and width
    const pageX = (Number(field.positionX) / 100) * width + left;
    const pageY = (Number(field.positionY) / 100) * height + top;

    const pageHeight = (Number(field.height) / 100) * height;
    const pageWidth = (Number(field.width) / 100) * width;

    setCoords({
      pageX: pageX,
      pageY: pageY,
      pageHeight: pageHeight,
      pageWidth: pageWidth,
    });
  }, [field.page, field.positionX, field.positionY, field.height, field.width]);

  useEffect(() => {
    calculateCoords();
  }, [calculateCoords]);

  return createPortal(
    <Rnd
      key={coords.pageX + coords.pageY + coords.pageHeight + coords.pageWidth}
      className={cn('pointer-events-none z-10 opacity-75')}
      default={{
        x: coords.pageX,
        y: coords.pageY,
        height: coords.pageHeight,
        width: coords.pageWidth,
      }}
      bounds={`${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.page}"]`}
    >
      <Card className={cn('bg-background border-primary/80 h-full w-full')}>
        <CardContent
          className={cn(
            'text-muted-foreground/50 flex h-full w-full flex-col items-center justify-center p-2',
          )}
        >
          {FRIENDLY_FIELD_TYPE[field.type]}

          <p className="text-muted-foreground/50 w-full truncate text-center text-xs">
            {signerEmail}
          </p>
        </CardContent>
      </Card>
    </Rnd>,
    document.body,
  );
};
