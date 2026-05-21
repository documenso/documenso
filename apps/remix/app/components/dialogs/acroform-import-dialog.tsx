import { useMemo, useState } from 'react';

import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Plural, Trans } from '@lingui/react/macro';
import { FieldType } from '@prisma/client';
import { CheckIcon, FormInputIcon } from 'lucide-react';

import type { TDetectedField } from '@documenso/lib/types/detected-field';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';

export type TDetectedFieldWithItem = TDetectedField & {
  envelopeItemId: string;
};

type AcroFormImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detectedFields: TDetectedFieldWithItem[];
  onImport: (fields: TDetectedFieldWithItem[]) => void;
};

const FIELD_TYPE_LABELS: Record<FieldType, MessageDescriptor> = {
  [FieldType.SIGNATURE]: msg`Signature`,
  [FieldType.FREE_SIGNATURE]: msg`Signature`,
  [FieldType.INITIALS]: msg`Initials`,
  [FieldType.NAME]: msg`Name`,
  [FieldType.EMAIL]: msg`Email`,
  [FieldType.DATE]: msg`Date`,
  [FieldType.TEXT]: msg`Text`,
  [FieldType.NUMBER]: msg`Number`,
  [FieldType.RADIO]: msg`Radio`,
  [FieldType.CHECKBOX]: msg`Checkbox`,
  [FieldType.DROPDOWN]: msg`Dropdown`,
  [FieldType.CALCULATED]: msg`Calculated`,
};

/**
 * Build a stable key for a detected field so selection survives re-renders.
 */
const getFieldKey = (field: TDetectedFieldWithItem, index: number): string =>
  `${field.envelopeItemId}:${index}:${field.page}:${field.name}`;

export const AcroFormImportDialog = ({
  open,
  onOpenChange,
  detectedFields,
  onImport,
}: AcroFormImportDialogProps) => {
  const { _ } = useLingui();

  const keyedFields = useMemo(
    () => detectedFields.map((field, index) => ({ key: getFieldKey(field, index), field })),
    [detectedFields],
  );

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set(detectedFields.map((field, index) => getFieldKey(field, index))),
  );

  const allSelected = keyedFields.length > 0 && selectedKeys.size === keyedFields.length;

  const toggleKey = (key: string) => {
    setSelectedKeys((previous) => {
      const next = new Set(previous);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  };

  const toggleAll = () => {
    setSelectedKeys((previous) => {
      if (previous.size === keyedFields.length) {
        return new Set();
      }

      return new Set(keyedFields.map(({ key }) => key));
    });
  };

  const onImportClick = () => {
    const selected = keyedFields
      .filter(({ key }) => selectedKeys.has(key))
      .map(({ field }) => field);

    onImport(selected);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <Trans>Import form fields</Trans>
          </DialogTitle>
        </DialogHeader>

        {keyedFields.length === 0 ? (
          <div className="flex flex-col items-center py-8">
            <FormInputIcon className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-center text-sm text-muted-foreground">
              <Trans>No form fields were found in your document.</Trans>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <Plural
                value={keyedFields.length}
                one="We found # fillable form field in your uploaded PDF. Choose which to import."
                other="We found # fillable form fields in your uploaded PDF. Choose which to import."
              />
            </p>

            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              <Trans>Select all</Trans>
            </label>

            <ul className="max-h-[320px] divide-y overflow-y-auto rounded-lg border">
              {keyedFields.map(({ key, field }) => (
                <li key={key} className="flex items-center gap-3 px-4 py-3">
                  <Checkbox
                    checked={selectedKeys.has(key)}
                    onCheckedChange={() => toggleKey(key)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {field.name || _(FIELD_TYPE_LABELS[field.type])}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {_(FIELD_TYPE_LABELS[field.type])}
                      {' · '}
                      <Trans>Page {field.page}</Trans>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            <Trans>Cancel</Trans>
          </Button>

          {keyedFields.length > 0 && (
            <Button type="button" onClick={onImportClick} disabled={selectedKeys.size === 0}>
              <CheckIcon className="-ml-1 mr-2 h-4 w-4" />
              <Plural value={selectedKeys.size} one="Import # field" other="Import # fields" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
