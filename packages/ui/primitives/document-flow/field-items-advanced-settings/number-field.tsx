import { useState } from 'react';

import { Trans, useLingui } from '@lingui/react/macro';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { validateNumberField } from '@documenso/lib/advanced-fields-validation/validate-number';
import { type TNumberFieldMeta as NumberFieldMeta } from '@documenso/lib/types/field-meta';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Switch } from '@documenso/ui/primitives/switch';

import { numberFormatValues } from './constants';

type NumberFieldAdvancedSettingsProps = {
  fieldState: NumberFieldMeta;
  handleFieldChange: (key: keyof NumberFieldMeta, value: string | boolean) => void;
  handleErrors: (errors: string[]) => void;
};

export const NumberFieldAdvancedSettings = ({
  fieldState,
  handleFieldChange,
  handleErrors,
}: NumberFieldAdvancedSettingsProps) => {
  const { t } = useLingui();

  const [showValidation, setShowValidation] = useState(false);

  const handleInput = (field: keyof NumberFieldMeta, value: string | boolean) => {
    const userValue = field === 'value' ? value : (fieldState.value ?? 0);
    const userMinValue = field === 'minValue' ? Number(value) : Number(fieldState.minValue ?? 0);
    const userMaxValue = field === 'maxValue' ? Number(value) : Number(fieldState.maxValue ?? 0);
    const readOnly = field === 'readOnly' ? Boolean(value) : Boolean(fieldState.readOnly);
    const required = field === 'required' ? Boolean(value) : Boolean(fieldState.required);
    const numberFormat = field === 'numberFormat' ? String(value) : (fieldState.numberFormat ?? '');
    const fontSize = field === 'fontSize' ? Number(value) : Number(fieldState.fontSize ?? 14);

    const valueErrors = validateNumberField(String(userValue), {
      minValue: userMinValue,
      maxValue: userMaxValue,
      readOnly,
      required,
      numberFormat,
      fontSize,
      type: 'number',
    });
    handleErrors(valueErrors);

    handleFieldChange(field, value);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>
          <Trans>Label</Trans>
        </Label>
        <Input
          id="label"
          className="bg-background mt-2"
          placeholder={t`Label`}
          value={fieldState.label}
          onChange={(e) => handleFieldChange('label', e.target.value)}
        />
      </div>
      <div>
        <Label className="mt-4">
          <Trans>Placeholder</Trans>
        </Label>
        <Input
          id="placeholder"
          className="bg-background mt-2"
          placeholder={t`Placeholder`}
          value={fieldState.placeholder}
          onChange={(e) => handleFieldChange('placeholder', e.target.value)}
        />
      </div>
      <div>
        <Label className="mt-4">
          <Trans>Value</Trans>
        </Label>
        <Input
          id="value"
          className="bg-background mt-2"
          placeholder={t`Value`}
          value={fieldState.value}
          onChange={(e) => handleInput('value', e.target.value)}
        />
      </div>
      <div>
        <Label>
          <Trans>Number format</Trans>
        </Label>
        <Select
          value={fieldState.numberFormat ?? ''}
          onValueChange={(val) => handleInput('numberFormat', val)}
        >
          <SelectTrigger className="text-muted-foreground bg-background mt-2 w-full">
            <SelectValue placeholder={t`Field format`} />
          </SelectTrigger>
          <SelectContent position="popper">
            {numberFormatValues.map((item, index) => (
              <SelectItem key={index} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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

      <div className="mt-2 flex flex-col gap-4">
        <div className="flex flex-row items-center gap-2">
          <Switch
            className="bg-background"
            checked={fieldState.required}
            onCheckedChange={(checked) => handleInput('required', checked)}
          />
          <Label>
            <Trans>Required field</Trans>
          </Label>
        </div>
        <div className="flex flex-row items-center gap-2">
          <Switch
            className="bg-background"
            checked={fieldState.readOnly}
            onCheckedChange={(checked) => handleInput('readOnly', checked)}
          />
          <Label>
            <Trans>Read only</Trans>
          </Label>
        </div>
      </div>
      <Button
        className="bg-foreground/10 hover:bg-foreground/5 border-foreground/10 mt-2 border"
        variant="outline"
        onClick={() => setShowValidation((prev) => !prev)}
      >
        <span className="flex w-full flex-row justify-between">
          <span className="flex items-center">
            <Trans>Validation</Trans>
          </span>
          {showValidation ? <ChevronUp /> : <ChevronDown />}
        </span>
      </Button>
      {showValidation && (
        <div className="mb-4 flex flex-row gap-x-4">
          <div className="flex flex-col">
            <Label className="mt-4">
              <Trans>Min</Trans>
            </Label>
            <Input
              id="minValue"
              className="bg-background mt-2"
              placeholder={t`E.g. 0`}
              value={fieldState.minValue ?? ''}
              onChange={(e) => handleInput('minValue', e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <Label className="mt-4">
              <Trans>Max</Trans>
            </Label>
            <Input
              id="maxValue"
              className="bg-background mt-2"
              placeholder={t`E.g. 100`}
              value={fieldState.maxValue ?? ''}
              onChange={(e) => handleInput('maxValue', e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
