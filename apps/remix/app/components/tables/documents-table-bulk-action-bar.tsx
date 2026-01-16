import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { FolderInput, Trash2, X } from 'lucide-react';

import { Button } from '@documenso/ui/primitives/button';

export type DocumentsTableBulkActionBarProps = {
  selectedCount: number;
  onMoveToFolder: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
};

export const DocumentsTableBulkActionBar = ({
  selectedCount,
  onMoveToFolder,
  onDelete,
  onClearSelection,
}: DocumentsTableBulkActionBarProps) => {
  const { _ } = useLingui();

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-x-4 rounded-lg border border-border bg-widget px-4 py-3 shadow-lg">
      <span className="text-sm font-medium">
        <Trans>{selectedCount} selected</Trans>
      </span>

      <div className="h-6 w-px bg-border" />

      <Button variant="outline" size="sm" onClick={onMoveToFolder}>
        <FolderInput className="mr-2 h-4 w-4" />
        <Trans>Move to Folder</Trans>
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onDelete}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        <Trans>Delete</Trans>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={onClearSelection}
        aria-label={_(msg`Clear selection`)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
