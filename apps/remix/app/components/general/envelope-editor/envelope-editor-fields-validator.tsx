import { Trans } from '@lingui/react/macro';
import { type Field } from '@prisma/client';

import type { TLocalField } from '@documenso/lib/client-only/hooks/use-editor-fields';
import { AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { DialogClose } from '@documenso/ui/primitives/dialog';

export const arrangeDuplicatedFields = (
  fields: TLocalField[],
  existingFields: TLocalField[],
): void => {
  const occupiedPositions = new Set<string>(
    existingFields.map((f) => `${f.positionX},${f.positionY}`),
  );
  for (const field of fields) {
    for (let shift = 3; shift <= 99; shift += 3) {
      const key = `${field.positionX + shift},${field.positionY + shift}`;
      if (!occupiedPositions.has(key)) {
        occupiedPositions.add(key);
        // TODO must check out of the page or not
        // luckily it will throw "cannot save document"
        field.positionX += shift - 3; // duplicateField() will add 3, so pre-subtract
        field.positionY += shift - 3;
        break;
      }
    }
  }
};

type Rect = {
  positionX: number;
  positionY: number;
  width: number;
  height: number;
};

const doRectangleEnclose = (outer: Rect, inner: Rect): boolean => {
  const outerRight = outer.positionX + outer.width;
  const outerBottom = outer.positionY + outer.height;
  const innerRight = inner.positionX + inner.width;
  const innerBottom = inner.positionY + inner.height;

  return (
    outer.positionX <= inner.positionX &&
    outer.positionY <= inner.positionY &&
    outerRight >= innerRight &&
    outerBottom >= innerBottom
  );
};

export const getMutualEnclosingFields = <T extends Field>(fields: T[]): T[] => {
  const enclosingFields = new Set<T>();
  for (let i = 0; i < fields.length; i++) {
    const rectA: Rect = {
      positionX: Number(fields[i].positionX),
      positionY: Number(fields[i].positionY),
      height: Number(fields[i].height),
      width: Number(fields[i].width),
    };
    for (let j = i + 1; j < fields.length; j++) {
      const rectB: Rect = {
        positionX: Number(fields[j].positionX),
        positionY: Number(fields[j].positionY),
        height: Number(fields[j].height),
        width: Number(fields[j].width),
      };
      if (doRectangleEnclose(rectA, rectB) || doRectangleEnclose(rectB, rectA)) {
        enclosingFields.add(fields[i]);
        enclosingFields.add(fields[j]);
      }
    }
  }

  return Array.from(enclosingFields);
};

export type EnvelopeEnclosingFieldsAlertProps = {
  mutualEnclosingFields: Field[];
  envelopeItems: { id: string; title: string }[];
  localFields: TLocalField[];
  onNavigateToField: (envelopeItemId: string, formId: string) => void;
};

export const EnvelopeEnclosingFieldsAlert = ({
  mutualEnclosingFields,
  envelopeItems,
  localFields,
  onNavigateToField,
}: EnvelopeEnclosingFieldsAlertProps) => {
  const itemSet = new Map(envelopeItems.map((i) => [i.id, i.title]));

  return (
    <AlertDescription>
      <Trans>Some fields are covering other fields or stacked on top of each other.</Trans>

      <ul className="mt-3 list-inside list-disc">
        {mutualEnclosingFields.map((field) => (
          <li key={field.id} className="flex items-center border-t py-3">
            <div className="flex-1">
              <div className="text-sm font-medium text-black">
                Field <u>{field.id}</u> on page {field.page}
              </div>
              <div className="text-xs text-muted-foreground dark:text-black/50">
                {itemSet.get(field.envelopeItemId)}
              </div>
            </div>

            <div className="flex-none">
              <DialogClose asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto px-2 py-1 text-sm"
                  onClick={() => {
                    const localField = localFields.find((f) => f.id === field.id);

                    if (localField) {
                      onNavigateToField(field.envelopeItemId, localField.formId);
                    }
                  }}
                >
                  <Trans>Edit</Trans>
                </Button>
              </DialogClose>
            </div>
          </li>
        ))}
      </ul>
    </AlertDescription>
  );
};
