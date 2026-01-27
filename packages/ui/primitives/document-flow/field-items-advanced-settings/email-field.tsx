import { Trans, useLingui } from '@lingui/react/macro';

import { validateFields as validateEmailFields } from '@documenso/lib/advanced-fields-validation/validate-fields';
import { type TEmailFieldMeta as EmailFieldMeta } from '@documenso/lib/types/field-meta';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';

type EmailFieldAdvancedSettingsProps = {
  fieldState: EmailFieldMeta;
  handleFieldChange: (key: keyof EmailFieldMeta, value: string | boolean) => void;
  handleErrors: (errors: string[]) => void;
};

export const EmailFieldAdvancedSettings = ({
  fieldState,
  handleFieldChange,
  handleErrors,
}: EmailFieldAdvancedSettingsProps) => {
  const { t } = useLingui();

  const handleInput = (field: keyof EmailFieldMeta, value: string | boolean) => {
    const fontSize = field === 'fontSize' ? Number(value) : Number(fieldState.fontSize ?? 14);

    const errors = validateEmailFields({
      fontSize,
      type: 'email',
    });

    handleErrors(errors);
    handleFieldChange(field, value);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>
          <Trans>Font Size</Trans>
        </Label>
        <Input
          id="fontSize"
          type="number"
          className="bg-background mt-2"
          placeholder={t`Field font size`}
          value={fieldState.fontSize}
          onChange={(e) => handleInput('fontSize', e.target.value)}
          min={8}
          max={96}
        />
      </div>

      <div>
        <Label>
          <Trans>Text Align</Trans>
        </Label>

        <Select
          value={fieldState.textAlign}
          onValueChange={(value) => handleInput('textAlign', value)}
        >
          <SelectTrigger className="bg-background mt-2">
            <SelectValue placeholder={t`Select text align`} />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
