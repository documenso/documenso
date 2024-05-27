'use client';

import { useEffect, useMemo, useState } from 'react';

import { ChevronDown, ChevronUp, Trash } from 'lucide-react';

import { type TDropdownFieldMeta as DropdownFieldMeta } from '@documenso/lib/types/field-field-meta';
import { ZDropdownFieldMeta } from '@documenso/lib/types/field-field-meta';
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

type DropdownFieldAdvancedSettingsProps = {
  fieldState: DropdownFieldMeta;
  handleFieldChange: (key: keyof DropdownFieldMeta, value: string | { value: string }[]) => void;
  handleToggleChange: (key: keyof DropdownFieldMeta) => void;
};

export const DropdownFieldAdvancedSettings = ({
  fieldState,
  handleFieldChange,
  handleToggleChange,
}: DropdownFieldAdvancedSettingsProps) => {
  const parsedFieldState = ZDropdownFieldMeta.parse(fieldState);
  // Weird type check to handle the case where the values are not an array of objects
  const fieldStateValues: { value: string }[] = useMemo(() => {
    return Array.isArray(fieldState.values)
      ? fieldState.values.map((value) => (typeof value === 'string' ? { value } : value))
      : [{ value: 'Option 1' }];
  }, [fieldState.values]);

  const [showValidation, setShowValidation] = useState(false);
  const [values, setValues] = useState(fieldStateValues);

  const addValue = () => {
    setValues([...values, { value: 'New option' }]);
  };

  const removeValue = (index: number) => {
    if (values.length === 1) return;

    const newValues = [...values];
    newValues.splice(index, 1);
    setValues(newValues);
    handleFieldChange('values', newValues);
  };

  useEffect(() => {
    setValues(fieldStateValues);
  }, [fieldStateValues]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Select default option</Label>
        <Select
          value={fieldState.defaultValue}
          onValueChange={(val) => handleFieldChange('defaultValue', val)}
        >
          <SelectTrigger className="text-muted-foreground mt-2 w-full bg-white">
            <SelectValue placeholder={'-- Select --'} />
          </SelectTrigger>
          <SelectContent position="popper">
            {values.map((item, index) => (
              <SelectItem key={index} value={item.value}>
                {item.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          <span className="flex items-center">Dropdown options</span>
          {showValidation ? <ChevronUp /> : <ChevronDown />}
        </span>
      </Button>

      {showValidation && (
        <div>
          {values.map((value, index) => (
            <div key={index} className="mt-2 flex items-center gap-4">
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
            Add another option
          </Button>
        </div>
      )}
    </div>
  );
};
