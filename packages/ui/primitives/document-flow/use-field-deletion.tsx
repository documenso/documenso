import { useRef, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useHotkeys } from 'react-hotkeys-hook';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../alert-dialog';
import { ToastAction } from '../toast';
import { useToast } from '../use-toast';

type FieldWithFormId = { formId: string };

/**
 * Number of fields that, when deleted at once, triggers a confirmation prompt.
 */
export const BULK_DELETE_CONFIRM_THRESHOLD = 3;

export type UseFieldDeletionOptions<T extends FieldWithFormId> = {
  /** Returns the current list of fields. */
  getFields: () => T[];
  /** Adds a field back (used for undo). */
  append: (_field: T) => void;
  /** Removes fields by index. */
  remove: (_index: number | number[]) => void;
  /** Called after fields are added/removed so the caller can persist changes. */
  onAfterChange?: () => void;
  /** Lets the caller keep its own "active field" highlight in sync. */
  onActiveFieldIdChange?: (_formId: string | null) => void;
};

/**
 * Shared selection + deletion behaviour for the field-placement editors
 * (document, template and embed authoring). Provides:
 *
 * - multi-select (ctrl/cmd/shift + click)
 * - Delete/Backspace keyboard removal of the selection
 * - confirmation when deleting several fields at once
 * - undo of the last deletion (Ctrl/Cmd+Z or the "Undo" toast action)
 */
export const useFieldDeletion = <T extends FieldWithFormId>({
  getFields,
  append,
  remove,
  onAfterChange,
  onActiveFieldIdChange,
}: UseFieldDeletionOptions<T>) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);

  // Stack of previously deleted field batches. Kept in a ref so the toast's
  // "Undo" callback always reads the latest value rather than a stale closure.
  const deletedFieldsRef = useRef<T[][]>([]);

  const restoreLastDeletedFields = () => {
    const lastDeleted = deletedFieldsRef.current.pop();

    if (!lastDeleted || lastDeleted.length === 0) {
      return;
    }

    lastDeleted.forEach((field) => append(field));

    onAfterChange?.();
  };

  const deleteFieldsByIds = (formIds: string[]) => {
    if (formIds.length === 0) {
      return;
    }

    const currentFields = getFields();
    const removedFields = currentFields.filter((field) => formIds.includes(field.formId));

    if (removedFields.length === 0) {
      return;
    }

    const indicesToRemove = currentFields
      .map((field, index) => (formIds.includes(field.formId) ? index : -1))
      .filter((index) => index !== -1);

    remove(indicesToRemove);

    deletedFieldsRef.current.push(removedFields);
    setSelectedFieldIds([]);
    onActiveFieldIdChange?.(null);

    onAfterChange?.();

    toast({
      title: removedFields.length > 1 ? _(msg`Fields deleted`) : _(msg`Field deleted`),
      description:
        removedFields.length > 1
          ? _(msg`${removedFields.length} fields were removed.`)
          : _(msg`The field was removed.`),
      action: (
        <ToastAction altText={_(msg`Undo`)} onClick={() => restoreLastDeletedFields()}>
          <Trans>Undo</Trans>
        </ToastAction>
      ),
    });
  };

  /**
   * Deletes the given fields, prompting for confirmation first when removing
   * several at once.
   */
  const requestDeleteFields = (formIds: string[]) => {
    if (formIds.length === 0) {
      return;
    }

    if (formIds.length >= BULK_DELETE_CONFIRM_THRESHOLD) {
      setBulkDeleteIds(formIds);
      return;
    }

    deleteFieldsByIds(formIds);
  };

  /**
   * Removes a field, extending the deletion to the whole selection when the
   * field is part of a multi-selection.
   */
  const removeField = (formId: string) => {
    const idsToDelete =
      selectedFieldIds.includes(formId) && selectedFieldIds.length > 1
        ? selectedFieldIds
        : [formId];

    requestDeleteFields(idsToDelete);
  };

  const onFieldActivate = (
    formId: string,
    options?: { multi?: boolean; keepIfSelected?: boolean },
  ) => {
    onActiveFieldIdChange?.(formId);

    setSelectedFieldIds((prev) => {
      if (options?.multi) {
        return prev.includes(formId) ? prev.filter((id) => id !== formId) : [...prev, formId];
      }

      if (options?.keepIfSelected && prev.includes(formId)) {
        return prev;
      }

      return [formId];
    });
  };

  const onSelectedFieldsDelete = (event?: KeyboardEvent | null) => {
    if (selectedFieldIds.length === 0) {
      return;
    }

    event?.preventDefault();
    requestDeleteFields(selectedFieldIds);
  };

  const onUndoDelete = (event?: KeyboardEvent | null) => {
    if (deletedFieldsRef.current.length === 0) {
      return;
    }

    event?.preventDefault();
    restoreLastDeletedFields();
  };

  useHotkeys(['delete', 'backspace'], (event) => onSelectedFieldsDelete(event));
  useHotkeys(['ctrl+z', 'meta+z'], (event) => onUndoDelete(event));
  useHotkeys(['escape'], () => setSelectedFieldIds([]));

  return {
    selectedFieldIds,
    setSelectedFieldIds,
    isFieldSelected: (formId: string) => selectedFieldIds.includes(formId),
    onFieldActivate,
    removeField,
    requestDeleteFields,
    // Bulk-delete confirmation dialog wiring.
    bulkDeleteCount: bulkDeleteIds?.length ?? 0,
    isBulkDeleteOpen: bulkDeleteIds !== null,
    onBulkDeleteOpenChange: (open: boolean) => {
      if (!open) {
        setBulkDeleteIds(null);
      }
    },
    confirmBulkDelete: () => {
      if (bulkDeleteIds) {
        deleteFieldsByIds(bulkDeleteIds);
      }

      setBulkDeleteIds(null);
    },
  };
};

export type BulkDeleteFieldsDialogProps = {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  onConfirm: () => void;
  count: number;
};

export const BulkDeleteFieldsDialog = ({
  open,
  onOpenChange,
  onConfirm,
  count,
}: BulkDeleteFieldsDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <Trans>Delete {count} fields?</Trans>
          </AlertDialogTitle>
          <AlertDialogDescription>
            <Trans>You're about to delete {count} fields. You can undo this afterwards.</Trans>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>
            <Trans>Cancel</Trans>
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            <Trans>Delete</Trans>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
