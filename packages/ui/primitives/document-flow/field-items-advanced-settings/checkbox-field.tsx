'use client';

import { useEffect, useState } from 'react';

import { ChevronDown, ChevronUp, Trash } from 'lucide-react';

import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
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

import type { CheckboxFieldMeta } from '.././field-item-advanced-settings';
import { checkboxValidationLength, checkboxValidationRules } from './constants';

type CheckboxFieldAdvancedSettingsProps = {
  fieldState: CheckboxFieldMeta;
  handleFieldChange: (
    key: keyof CheckboxFieldMeta,
    value: string | { checked: boolean; value: string }[],
  ) => void;
  handleToggleChange: (key: keyof CheckboxFieldMeta) => void;
};

export const CheckboxFieldAdvancedSettings = ({
  fieldState,
  handleFieldChange,
  handleToggleChange,
}: CheckboxFieldAdvancedSettingsProps) => {
  const [showValidation, setShowValidation] = useState(false);
  const [values, setValues] = useState(fieldState.values ?? [{ checked: false, value: '' }]);

  const addValue = () => {
    setValues([...values, { checked: false, value: '' }]);
  };

  // This might look redundant but the values are not updated when the fieldState is updated withouth this useEffect
  useEffect(() => {
    setValues(fieldState.values ?? [{ checked: false, value: '' }]);
  }, [fieldState.values]);

  const removeValue = (index: number) => {
    if (values.length === 1) return;

    const newValues = [...values];
    newValues.splice(index, 1);
    setValues(newValues);
    handleFieldChange('values', newValues);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row items-center gap-x-4">
        <div className="flex w-2/3 flex-col">
          <Label>Validation</Label>
          <Select
            value={fieldState.validationRule}
            onValueChange={(val) => handleFieldChange('validationRule', val)}
          >
            <SelectTrigger className="text-muted-foreground mt-2 w-full bg-white">
              <SelectValue placeholder="Select at least" />
            </SelectTrigger>
            <SelectContent position="popper">
              {checkboxValidationRules.map((item, index) => (
                <SelectItem key={index} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex w-1/3 flex-col">
          <Select
            value={fieldState.validationLength ? String(fieldState.validationLength) : ''}
            onValueChange={(val) => handleFieldChange('validationLength', val)}
          >
            <SelectTrigger className="text-muted-foreground mt-2 w-full bg-white">
              <SelectValue placeholder="Pick a number" />
            </SelectTrigger>
            <SelectContent position="popper">
              {checkboxValidationLength.map((item, index) => (
                <SelectItem key={index} value={String(item)}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-row items-center gap-2">
          <Switch
            className="bg-background"
            checked={fieldState.required}
            onChange={() => handleToggleChange('required')}
            onClick={() => handleToggleChange('required')}
          />
          <Label>Required field</Label>
        </div>
        <div className="flex flex-row items-center gap-2">
          <Switch
            className="bg-background"
            checked={fieldState.readOnly}
            onChange={() => handleToggleChange('readOnly')}
            onClick={() => handleToggleChange('readOnly')}
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
          <span className="flex items-center">Checkbox values</span>
          {showValidation ? <ChevronUp /> : <ChevronDown />}
        </span>
      </Button>

      {showValidation && (
        <div>
          {values.map((value, index) => (
            <div key={index} className="mt-2 flex items-center gap-4">
              <Checkbox
                className="data-[state=checked]:bg-documenso border-foreground/30 h-5 w-5"
                checkClassName="text-white"
                checked={value.checked}
                onCheckedChange={(checked) => {
                  const newValues = [...values];
                  newValues[index].checked = Boolean(checked);
                  setValues(newValues);
                  handleFieldChange('values', newValues);
                }}
              />
              <Input
                className="w-1/2"
                value={value.value}
                onChange={(e) => {
                  const newValues = [...values];
                  newValues[index].value = e.target.value;
                  setValues(newValues);
                  handleFieldChange('values', newValues);
                }}
              />
              <button
                type="button"
                className="col-span-1 mt-auto inline-flex h-10 w-10 items-center  text-slate-500 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  removeValue(index);
                }}
              >
                <Trash className="h-5 w-5" />
              </button>
            </div>
          ))}
          <Button
            className="bg-foreground/10 hover:bg-foreground/5 border-foreground/10 ml-9 mt-4 border"
            variant="outline"
            onClick={addValue}
          >
            Add another value
          </Button>
        </div>
      )}
    </div>
  );
};
