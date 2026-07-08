import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { cn } from '@documenso/ui/lib/utils';
import { Plural } from '@lingui/react/macro';
import { FileTextIcon } from 'lucide-react';

type EnvelopeItemSelectorProps = {
  primaryText: React.ReactNode;
  secondaryText: React.ReactNode;
  isSelected: boolean;
  buttonProps: React.ButtonHTMLAttributes<HTMLButtonElement>;
  actionSlot?: React.ReactNode;
};

export const EnvelopeItemSelector = ({
  primaryText,
  secondaryText,
  isSelected,
  buttonProps,
  actionSlot,
}: EnvelopeItemSelectorProps) => {
  return (
    <div
      className={cn(
        'group relative flex h-9 max-w-64 flex-shrink-0 items-center rounded-md border transition-colors',
        isSelected
          ? 'border-border bg-background text-foreground shadow-sm'
          : 'border-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground',
      )}
    >
      <button
        type="button"
        title={typeof primaryText === 'string' ? primaryText : undefined}
        aria-pressed={isSelected}
        className={cn(
          'flex h-full min-w-0 cursor-pointer items-center gap-2 rounded-md pl-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          actionSlot ? 'pr-1' : 'pr-3',
        )}
        {...buttonProps}
      >
        <FileTextIcon className="h-4 w-4 flex-shrink-0 opacity-60" />
        <span className="truncate font-medium text-sm">{primaryText}</span>
        {secondaryText ? (
          <span
            className={cn(
              'flex-shrink-0 rounded-full px-1.5 py-px text-xs tabular-nums',
              isSelected
                ? 'bg-green-100 text-green-700 dark:bg-green-400/20 dark:text-green-400'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {secondaryText}
          </span>
        ) : null}
      </button>

      {actionSlot && <div className="flex flex-shrink-0 items-center pr-2">{actionSlot}</div>}
    </div>
  );
};

type EnvelopeRendererFileSelectorProps = {
  fields: { envelopeItemId: string }[];
  className?: string;
  secondaryOverride?: React.ReactNode;
  renderItemAction?: (item: { id: string; title: string }) => React.ReactNode;
};

export const EnvelopeRendererFileSelector = ({
  fields,
  className,
  secondaryOverride,
  renderItemAction,
}: EnvelopeRendererFileSelectorProps) => {
  const { envelopeItems, currentEnvelopeItem, setCurrentEnvelopeItem } = useCurrentEnvelopeRender();

  return (
    <div className={cn('scrollbar-hidden flex h-fit flex-shrink-0 gap-1.5 overflow-x-auto py-3', className)}>
      {envelopeItems.map((doc) => (
        <EnvelopeItemSelector
          key={doc.id}
          primaryText={doc.title}
          secondaryText={
            secondaryOverride ?? (
              <Plural
                one="1 Field"
                other="# Fields"
                value={fields.filter((field) => field.envelopeItemId === doc.id).length}
              />
            )
          }
          isSelected={currentEnvelopeItem?.id === doc.id}
          buttonProps={{
            onClick: () => setCurrentEnvelopeItem(doc.id),
          }}
          actionSlot={renderItemAction?.(doc)}
        />
      ))}
    </div>
  );
};
