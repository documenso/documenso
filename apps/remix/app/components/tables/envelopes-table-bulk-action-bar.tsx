import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { FolderInputIcon, Trash2Icon, XIcon } from 'lucide-react';

import { Button } from '@documenso/ui/primitives/button';

export type EnvelopesTableBulkActionBarProps = {
  selectedCount: number;
  onMoveClick: () => void;
  onDeleteClick: () => void;
  onClearSelection: () => void;
};

export const EnvelopesTableBulkActionBar = ({
  selectedCount,
  onMoveClick,
  onDeleteClick,
  onClearSelection,
}: EnvelopesTableBulkActionBarProps) => {
  const { t } = useLingui();

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-x-4 rounded-lg border border-border bg-background px-4 py-3 shadow-lg">
      <span className="text-sm font-medium">
        <Trans>{selectedCount} selected</Trans>
      </span>

      <div className="h-6 w-px bg-border" />

      <Button type="button" variant="outline" size="sm" onClick={onMoveClick}>
        <FolderInputIcon className="mr-2 h-4 w-4" />
        <Trans>Move to Folder</Trans>
      </Button>

      <Button type="button" variant="destructive" size="sm" onClick={onDeleteClick}>
        <Trash2Icon className="mr-2 h-4 w-4" />
        <Trans>Delete</Trans>
      </Button>

      <Button variant="ghost" size="sm" onClick={onClearSelection} aria-label={t`Clear selection`}>
        <XIcon className="h-4 w-4" />
      </Button>
    </div>
  );
};
