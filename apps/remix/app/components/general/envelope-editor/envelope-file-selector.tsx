import { Plural } from '@lingui/react/macro';

import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { cn } from '@documenso/ui/lib/utils';

type EnvelopeItemSelectorProps = {
  number: number;
  primaryText: React.ReactNode;
  secondaryText: React.ReactNode;
  isSelected: boolean;
  buttonProps: React.ButtonHTMLAttributes<HTMLButtonElement>;
};

export const EnvelopeItemSelector = ({
  number,
  primaryText,
  secondaryText,
  isSelected,
  buttonProps,
}: EnvelopeItemSelectorProps) => {
  return (
    <button
      className={`flex min-w-0 cursor-pointer items-center space-x-3 rounded-lg border px-4 py-3 transition-colors ${
        isSelected
          ? 'border-blue-200 bg-blue-50 text-blue-900'
          : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
      }`}
      {...buttonProps}
    >
      <div
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
          isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-600'
        }`}
      >
        {number}
      </div>
      <div className="min-w-0 text-left">
        <div className="truncate text-sm font-medium">{primaryText}</div>
        <div className="text-xs text-gray-500">{secondaryText}</div>
      </div>
      <div
        className={cn('h-2 w-2 rounded-full', {
          'bg-blue-500': isSelected,
        })}
      ></div>
    </button>
  );
};

type EnvelopeRendererFileSelectorProps = {
  fields: { envelopeItemId: string }[];
  className?: string;
  secondaryOverride?: React.ReactNode;
};

export const EnvelopeRendererFileSelector = ({
  fields,
  className,
  secondaryOverride,
}: EnvelopeRendererFileSelectorProps) => {
  const { envelopeItems, currentEnvelopeItem, setCurrentEnvelopeItem } = useCurrentEnvelopeRender();

  return (
    <div className={cn('flex h-fit space-x-2 overflow-x-auto p-4', className)}>
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
        />
      ))}
    </div>
  );
};
