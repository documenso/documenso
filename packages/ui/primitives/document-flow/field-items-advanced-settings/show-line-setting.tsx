import { Trans } from '@lingui/react/macro';

import { Label } from '@documenso/ui/primitives/label';
import { Switch } from '@documenso/ui/primitives/switch';

type ShowLineSettingProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

/**
 * Toggle for the optional "signature line" — a horizontal rule drawn near the
 * bottom of the field so the sealed document looks like a traditional paper
 * form (a line to sign on, or a line beneath a name/date/etc.).
 */
export const ShowLineSetting = ({ checked, onChange }: ShowLineSettingProps) => {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-row items-center gap-2">
        <Switch className="bg-background" checked={checked} onCheckedChange={onChange} />
        <Label>
          <Trans>Show signature line</Trans>
        </Label>
      </div>
      <p className="text-muted-foreground text-xs">
        <Trans>Draws a line beneath the field, like a paper form.</Trans>
      </p>
    </div>
  );
};
