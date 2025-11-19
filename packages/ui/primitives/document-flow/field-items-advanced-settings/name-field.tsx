import { Trans, useLingui } from '@lingui/react/macro';

import { validateFields as validateNameFields } from '@doku-seal/lib/advanced-fields-validation/validate-fields';
import { type TNameFieldMeta as NameFieldMeta } from '@doku-seal/lib/types/field-meta';
import { Input } from '@doku-seal/ui/primitives/input';
import { Label } from '@doku-seal/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@doku-seal/ui/primitives/select';

type NameFieldAdvancedSettingsProps = {
  fieldState: NameFieldMeta;
  handleFieldChange: (key: keyof NameFieldMeta, value: string | boolean) => void;
  handleErrors: (errors: string[]) => void;
};

export const NameFieldAdvancedSettings = ({
  fieldState,
  handleFieldChange,
  handleErrors,
}: NameFieldAdvancedSettingsProps) => {
  const { t } = useLingui();

  const handleInput = (field: keyof NameFieldMeta, value: string | boolean) => {
    const fontSize = field === 'fontSize' ? Number(value) : Number(fieldState.fontSize ?? 14);

    const errors = validateNameFields({
      fontSize,
      type: 'name',
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
