import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { cn } from '@documenso/ui/lib/utils';
import { Plural } from '@lingui/react/macro';

type EnvelopeItemSelectorProps = {
  number: number;
  primaryText: React.ReactNode;
  secondaryText: React.ReactNode;
  isSelected: boolean;
  buttonProps: React.ButtonHTMLAttributes<HTMLButtonElement>;
  actionSlot?: React.ReactNode;
};

export const EnvelopeItemSelector = ({
  number,
  primaryText,
  secondaryText,
  isSelected,
  buttonProps,
  actionSlot,
}: EnvelopeItemSelectorProps) => {
  return (
    <button
      title={typeof primaryText === 'string' ? primaryText : undefined}
      className={`group flex h-fit max-w-72 flex-shrink-0 cursor-pointer items-center space-x-3 rounded-lg border px-4 py-3 transition-colors ${
        isSelected
          ? 'border-primary/40 bg-primary/10 text-documenso-800 dark:text-primary'
          : 'border-border bg-muted/50 hover:bg-muted/70'
      }`}
      {...buttonProps}
    >
      <div
        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full font-medium text-xs ${
          isSelected ? 'bg-primary/20 text-documenso-700 dark:text-primary' : 'bg-muted text-muted-foreground'
        }`}
      >
        {number}
      </div>
      <div className="min-w-0 text-left">
        <div className="truncate font-medium text-sm">{primaryText}</div>
        <div className="text-muted-foreground text-xs">{secondaryText}</div>
      </div>
      {actionSlot ?? (
        <div
          className={cn('h-2 w-2 flex-shrink-0 rounded-full', {
            'bg-primary': isSelected,
          })}
        />
      )}
    </button>
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
    <div className={cn('scrollbar-hidden flex h-fit flex-shrink-0 space-x-2 overflow-x-auto p-4', className)}>
      {envelopeItems.map((doc, i) => (
        <EnvelopeItemSelector
          key={doc.id}
          number={i + 1}
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
