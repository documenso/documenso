'use client';

import { useState } from 'react';

import { ChevronDown, ChevronUp } from 'lucide-react';

import { type TNumberFieldMeta as NumberFieldMeta } from '@documenso/lib/types/field-field-meta';
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
  handleFieldChange: (key: keyof NumberFieldMeta, value: string) => void;
  handleToggleChange: (key: keyof NumberFieldMeta) => void;
  handleErrors: (errors: string[]) => void;
};

export const NumberFieldAdvancedSettings = ({
  fieldState,
  handleFieldChange,
  handleToggleChange,
  handleErrors,
}: NumberFieldAdvancedSettingsProps) => {
  const [showValidation, setShowValidation] = useState(false);

  const handleValueChange = (key: keyof NumberFieldMeta, value: string) => {
    const newErrors = [];

    if (fieldState.minValue && fieldState.minValue > 0 && Number(value) < fieldState.minValue) {
      newErrors.push(`Value ${value} is less than the min value ${fieldState.minValue}`);
    }

    if (fieldState.maxValue && fieldState.maxValue > 0 && Number(value) > fieldState.maxValue) {
      newErrors.push(`Value ${value} is greater than the max value ${fieldState.maxValue}`);
    }

    handleErrors(newErrors);
    handleFieldChange(key, value);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Label</Label>
        <Input
          id="label"
          className="bg-background mt-2"
          placeholder="Label"
          value={fieldState.label}
          onChange={(e) => handleFieldChange('label', e.target.value)}
        />
      </div>
      <div>
        <Label className="mt-4">Placeholder</Label>
        <Input
          id="placeholder"
          className="bg-background mt-2"
          placeholder="Placeholder"
          value={fieldState.placeholder}
          onChange={(e) => handleFieldChange('placeholder', e.target.value)}
        />
      </div>
      <div>
        <Label className="mt-4">Value</Label>
        <Input
          id="value"
          className="bg-background mt-2"
          placeholder="Value"
          value={fieldState.value}
          onChange={(e) => handleValueChange('value', e.target.value)}
        />
      </div>
      <div>
        <Label>Number format</Label>
        <Select
          value={fieldState.numberFormat}
          onValueChange={(val) => handleFieldChange('numberFormat', val)}
        >
          <SelectTrigger className="text-muted-foreground mt-2 w-full bg-white">
            <SelectValue placeholder="Field format" />
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
      <div className="mt-2 flex flex-col gap-4">
        <div className="flex flex-row items-center gap-2">
          <Switch
            className="bg-background"
            checked={fieldState.required}
            onCheckedChange={() => {
              if (fieldState.readOnly === true) {
                handleToggleChange('readOnly');
              }
              handleToggleChange('required');
            }}
          />
          <Label>Required field</Label>
        </div>
        <div className="flex flex-row items-center gap-2">
          <Switch
            className="bg-background"
            checked={fieldState.readOnly}
            onCheckedChange={() => {
              if (fieldState.required) {
                handleToggleChange('required');
              }
              handleToggleChange('readOnly');
            }}
          />
          <Label>Read only</Label>
        </div>
      </div>
      <Button
        className="bg-foreground/10 hover:bg-foreground/5 border-foreground/10 mt-2 border"
        variant="outline"
        onClick={() => setShowValidation((prev) => !prev)}
      >
        <span className="flex w-full flex-row justify-between">
          <span className="flex items-center">Validation</span>
          {showValidation ? <ChevronUp /> : <ChevronDown />}
        </span>
      </Button>
      {showValidation && (
        <div className="mb-4 flex flex-row gap-x-4">
          <div className="flex flex-col">
            <Label className="mt-4">Min</Label>
            <Input
              id="minValue"
              className="bg-background mt-2"
              placeholder="E.g. 0"
              value={fieldState.minValue}
              onChange={(e) => handleFieldChange('minValue', e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <Label className="mt-4">Max</Label>
            <Input
              id="maxValue"
              className="bg-background mt-2"
              placeholder="E.g. 100"
              value={fieldState.maxValue}
              onChange={(e) => handleFieldChange('maxValue', e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
