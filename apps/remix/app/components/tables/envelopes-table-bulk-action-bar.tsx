import { useEffect } from 'react';

import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { DownloadIcon, FolderInputIcon, Trash2Icon, XIcon } from 'lucide-react';

import { Button } from '@documenso/ui/primitives/button';

export type EnvelopesTableBulkActionBarProps = {
  selectedCount: number;
  onDownloadClick?: () => void;
  onMoveClick: () => void;
  onDeleteClick: () => void;
  onClearSelection: () => void;
};

export const EnvelopesTableBulkActionBar = ({
  selectedCount,
  onDownloadClick,
  onMoveClick,
  onDeleteClick,
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
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-x-1 rounded-xl bg-popover/95 p-1.5 text-popover-foreground shadow-lg ring-1 ring-black/10 backdrop-blur-md supports-[backdrop-filter]:bg-popover/80 dark:ring-white/10">
      <div className="flex items-center gap-x-2 px-2">
        <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-primary px-1 text-xs font-semibold tabular-nums text-primary-foreground">
          {selectedCount}
        </span>
        <span className="max-[420px]:hidden text-sm font-medium text-foreground">
          <Trans>selected</Trans>
        </span>
      </div>

      <div className="mx-1 h-5 w-px bg-border" />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onMoveClick}
        className="h-8 gap-x-1.5 py-1.5 pl-2 pr-2.5"
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
          className="h-8 gap-x-1.5 py-1.5 pl-2 pr-2.5"
        >
          <DownloadIcon className="size-4 shrink-0" />
          <Trans>Download</Trans>
        </Button>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onDeleteClick}
        className="h-8 gap-x-1.5 py-1.5 pl-2 pr-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
