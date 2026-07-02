import { Button } from '@documenso/ui/primitives/button';
import { Trans, useLingui } from '@lingui/react/macro';
import { DownloadIcon, FolderInputIcon, Trash2Icon, XCircleIcon, XIcon } from 'lucide-react';
import { useEffect } from 'react';

export type EnvelopesTableBulkActionBarProps = {
  selectedCount: number;
  onDownloadClick?: () => void;
  onMoveClick: () => void;
  onDeleteClick: () => void;
  onCancelClick?: () => void;
  onClearSelection: () => void;
};

export const EnvelopesTableBulkActionBar = ({
  selectedCount,
  onDownloadClick,
  onMoveClick,
  onDeleteClick,
  onCancelClick,
  onClearSelection,
}: EnvelopesTableBulkActionBarProps) => {
  const { t } = useLingui();

  useEffect(() => {
    if (selectedCount === 0) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClearSelection();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedCount, onClearSelection]);

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-x-1 rounded-xl bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-black/10 dark:ring-white/10">
      <div className="flex items-center gap-x-2 px-2">
        <span className="sr-only" aria-live="polite">
          <Trans>{selectedCount} selected</Trans>
        </span>
        <span
          aria-hidden="true"
          className="flex h-5 min-w-5 items-center justify-center rounded-md bg-primary px-1 font-semibold text-primary-foreground text-xs tabular-nums"
        >
          {selectedCount}
        </span>
        <span aria-hidden="true" className="font-medium text-foreground text-sm max-[420px]:hidden">
          <Trans>selected</Trans>
        </span>
      </div>

      <div className="mx-1 h-5 w-px bg-border" />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onMoveClick}
        className="h-8 gap-x-1.5 py-1.5 pr-2.5 pl-2"
      >
        <FolderInputIcon className="size-4 shrink-0" />
        <Trans>Move</Trans>
      </Button>

      {onDownloadClick && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDownloadClick}
          className="h-8 gap-x-1.5 py-1.5 pr-2.5 pl-2"
        >
          <DownloadIcon className="size-4 shrink-0" />
          <Trans>Download</Trans>
        </Button>
      )}

      {onCancelClick && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancelClick}
          className="h-8 gap-x-1.5 py-1.5 pr-2.5 pl-2"
        >
          <XCircleIcon className="size-4 shrink-0" />
          <Trans>Cancel</Trans>
        </Button>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onDeleteClick}
        className="h-8 gap-x-1.5 py-1.5 pr-2.5 pl-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2Icon className="size-4 shrink-0" />
        <Trans>Delete</Trans>
      </Button>

      <div className="mx-1 h-5 w-px bg-border" />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClearSelection}
        aria-label={t`Clear selection`}
        className="h-8 w-8 p-0"
      >
        <XIcon className="size-4 shrink-0" />
      </Button>
    </div>
  );
};
