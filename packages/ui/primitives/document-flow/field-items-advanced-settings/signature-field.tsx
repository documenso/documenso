import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { Checkbox } from '@documenso/ui/primitives/checkbox';
import { Label } from '@documenso/ui/primitives/label';

type SignatureFieldAdvancedSettingsProps = {
  autosign: boolean;
  onAutosignChange: (value: boolean) => void;
};

export const SignatureFieldAdvancedSettings = ({
  autosign,
  onAutosignChange,
}: SignatureFieldAdvancedSettingsProps) => {
  const { _ } = useLingui();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="autosign"
          checked={autosign}
          onCheckedChange={(checked) => onAutosignChange(checked === true)}
        />
        <Label htmlFor="autosign" className="cursor-pointer">
          <Trans>Automatically sign this field</Trans>
        </Label>
      </div>
      <p className="text-muted-foreground text-sm">
        <Trans>
          When enabled, this signature field will be automatically signed when the document is sent
          to the recipient.
        </Trans>
      </p>
    </div>
  );
};
