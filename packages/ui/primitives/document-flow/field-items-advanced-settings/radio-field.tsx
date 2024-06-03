'use client';

import { useEffect, useState } from 'react';

import { ChevronDown, ChevronUp, Trash } from 'lucide-react';

import { type TRadioFieldMeta as RadioFieldMeta } from '@documenso/lib/types/field-field-meta';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { Switch } from '@documenso/ui/primitives/switch';

type RadioFieldAdvancedSettingsProps = {
  fieldState: RadioFieldMeta;
  handleFieldChange: (
    key: keyof RadioFieldMeta,
    value: string | { checked: boolean; value: string }[] | boolean,
  ) => void;
  handleErrors: (errors: string[]) => void;
};

export const RadioFieldAdvancedSettings = ({
  fieldState,
  handleFieldChange,
  handleErrors,
}: RadioFieldAdvancedSettingsProps) => {
  const [showValidation, setShowValidation] = useState(false);
  const [values, setValues] = useState(
    fieldState.values ?? [{ checked: false, value: 'Default value' }],
  );
  const [readOnly, setReadOnly] = useState(fieldState.readOnly ?? false);
  const [required, setRequired] = useState(fieldState.required ?? false);

  const validateReadOnlyAndRequired = (
    readOnly: boolean,
    required: boolean,
    values: { checked: boolean; value: string }[],
  ) => {
    const errors = [];

    if (readOnly && required) {
      errors.push('A field cannot be both read only and required');
    }

    if (readOnly && values.length === 0) {
      errors.push('A read only field must have at least one value');
    }

    return errors;
  };

  const addValue = () => {
    setValues([...values, { checked: false, value: '' }]);
    handleFieldChange('values', [...values, { checked: false, value: '' }]);
  };

  const removeValue = (index: number) => {
    if (values.length === 1) return;

    const newValues = [...values];
    newValues.splice(index, 1);
    setValues(newValues);
    handleFieldChange('values', newValues);
  };

  const handleCheckedChange = (checked: boolean, index: number) => {
    const newValues = values.map((val, idx) => {
      if (idx === index) {
        return { ...val, checked: Boolean(checked) };
      } else {
        return { ...val, checked: false };
      }
    });

    setValues(newValues);
    handleFieldChange('values', newValues);
  };

  const handleToggleChange = (field: keyof RadioFieldMeta, value: string | boolean) => {
    const readOnly = field === 'readOnly' ? Boolean(value) : Boolean(fieldState.readOnly);
    const required = field === 'required' ? Boolean(value) : Boolean(fieldState.required);
    setReadOnly(readOnly);
    setRequired(required);

    const errors = validateReadOnlyAndRequired(readOnly, required, values);
    handleErrors(errors);

    handleFieldChange(field, value);
  };

  const handleInputChange = (value: string, index: number) => {
    const newValues = [...values];
    newValues[index].value = value;
    setValues(newValues);
    handleFieldChange('values', newValues);

    return newValues;
  };

  useEffect(() => {
    setValues(fieldState.values ?? [{ checked: false, value: 'Default value' }]);
  }, [fieldState.values]);

  useEffect(() => {
    const errors = validateReadOnlyAndRequired(readOnly, required, values);
    handleErrors(errors);
  }, [values]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-row items-center gap-2">
          <Switch
            className="bg-background"
            checked={fieldState.required}
            onCheckedChange={(checked) => handleToggleChange('required', checked)}
          />
          <Label>Required field</Label>
        </div>
        <div className="flex flex-row items-center gap-2">
          <Switch
            className="bg-background"
            checked={fieldState.readOnly}
            onCheckedChange={(checked) => handleToggleChange('readOnly', checked)}
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
          <span className="flex items-center">Radio values</span>
          {showValidation ? <ChevronUp /> : <ChevronDown />}
        </span>
      </Button>

      {showValidation && (
        <div>
          {values.map((value, index) => (
            <div key={index} className="mt-2 flex items-center gap-4">
              <Checkbox
                className="data-[state=checked]:bg-documenso border-foreground/30 data-[state=checked]:ring-documenso dark:data-[state=checked]:ring-offset-background h-5 w-5 rounded-full data-[state=checked]:ring-1 data-[state=checked]:ring-offset-2 data-[state=checked]:ring-offset-white"
                checked={value.checked}
                onCheckedChange={(checked) => handleCheckedChange(Boolean(checked), index)}
              />
              <Input
                className="w-1/2"
                value={value.value}
                onChange={(e) => handleInputChange(e.target.value, index)}
              />
              <button
                type="button"
                className="col-span-1 mt-auto inline-flex h-10 w-10 items-center text-slate-500 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white"
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
