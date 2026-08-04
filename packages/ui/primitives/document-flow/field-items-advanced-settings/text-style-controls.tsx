import { Trans, useLingui } from '@lingui/react/macro';
import { BoldIcon, ItalicIcon } from 'lucide-react';

import { Label } from '../../label';
import { Toggle } from '../../toggle';

type TextStyleControlsProps<TFieldState extends { fontWeight?: string | null; fontStyle?: string | null }> = {
  fieldState: TFieldState;
  onChange: (key: keyof TFieldState, value: string) => void;
};

export const TextStyleControls = <TFieldState extends { fontWeight?: string | null; fontStyle?: string | null }>({
  fieldState,
  onChange,
}: TextStyleControlsProps<TFieldState>) => {
  const { t } = useLingui();

  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <Label>
          <Trans>Bold</Trans>
        </Label>

        <Toggle
          aria-label={t`Bold`}
          pressed={fieldState.fontWeight === 'bold'}
          size="sm"
          variant="outline"
          className="mt-2 w-full"
          onPressedChange={(pressed) => onChange('fontWeight', pressed ? 'bold' : 'normal')}
        >
          <BoldIcon className="h-4 w-4" />
        </Toggle>
      </div>

      <div>
        <Label>
          <Trans>Italic</Trans>
        </Label>

        <Toggle
          aria-label={t`Italic`}
          pressed={fieldState.fontStyle === 'italic'}
          size="sm"
          variant="outline"
          className="mt-2 w-full"
          onPressedChange={(pressed) => onChange('fontStyle', pressed ? 'italic' : 'normal')}
        >
          <ItalicIcon className="h-4 w-4" />
        </Toggle>
      </div>
    </div>
  );
};
