import { useEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { ChevronDown, ChevronUp, Trash } from 'lucide-react';

import { validateRadioField } from '@documenso/lib/advanced-fields-validation/validate-radio';
import { type TRadioFieldMeta as RadioFieldMeta } from '@documenso/lib/types/field-meta';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { Switch } from '@documenso/ui/primitives/switch';

export type RadioFieldAdvancedSettingsProps = {
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
  const { _ } = useLingui();

  const [showValidation, setShowValidation] = useState(false);
  const [values, setValues] = useState(
    fieldState.values ?? [{ id: 1, checked: false, value: 'Default value' }],
  );
  const [readOnly, setReadOnly] = useState(fieldState.readOnly ?? false);
  const [required, setRequired] = useState(fieldState.required ?? false);

  const addValue = () => {
    const newId = values.length > 0 ? Math.max(...values.map((val) => val.id)) + 1 : 1;
    const newValue = { id: newId, checked: false, value: '' };
    const updatedValues = [...values, newValue];

    setValues(updatedValues);
    handleFieldChange('values', updatedValues);
  };

  const removeValue = (id: number) => {
    if (values.length === 1) return;

    const newValues = values.filter((val) => val.id !== id);
    setValues(newValues);
    handleFieldChange('values', newValues);
  };

  const handleCheckedChange = (checked: boolean, id: number) => {
    const newValues = values.map((val) => {
      if (val.id === id) {
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

    const errors = validateRadioField(String(value), {
      readOnly,
      required,
      values,
      type: 'radio',
      direction: 'vertical',
    });
    handleErrors(errors);

    handleFieldChange(field, value);
  };

  const handleInputChange = (value: string, id: number) => {
    const newValues = values.map((val) => {
      if (val.id === id) {
        return { ...val, value };
      }
      return val;
    });

    setValues(newValues);
    handleFieldChange('values', newValues);

    return newValues;
  };

  useEffect(() => {
    setValues(fieldState.values ?? [{ id: 1, checked: false, value: 'Default value' }]);
  }, [fieldState.values]);

  useEffect(() => {
    const errors = validateRadioField(undefined, {
      readOnly,
      required,
      values,
      type: 'radio',
      direction: 'vertical',
    });
    handleErrors(errors);
  }, [values]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <div>
          <Label>
            <Trans>Label</Trans>
          </Label>
          <Input
            id="label"
            className="bg-background mt-2"
            placeholder={_(msg`Field label`)}
            value={fieldState.label}
            onChange={(e) => handleFieldChange('label', e.target.value)}
          />
        </div>
        <div className="flex flex-row items-center gap-2">
          <Switch
            className="bg-background"
            checked={fieldState.required}
            onCheckedChange={(checked) => handleToggleChange('required', checked)}
          />
          <Label>
            <Trans>Required field</Trans>
          </Label>
        </div>
        <div className="flex flex-row items-center gap-2">
          <Switch
            className="bg-background"
            checked={fieldState.readOnly}
            onCheckedChange={(checked) => handleToggleChange('readOnly', checked)}
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
            <Trans>Radio values</Trans>
          </span>
          {showValidation ? <ChevronUp /> : <ChevronDown />}
        </span>
      </Button>

      {showValidation && (
        <div>
          {values.map((value) => (
            <div key={value.id} className="mt-2 flex items-center gap-4">
              <Checkbox
                className="data-[state=checked]:bg-documenso border-foreground/30 data-[state=checked]:ring-primary dark:data-[state=checked]:ring-offset-background h-5 w-5 rounded-full data-[state=checked]:ring-1 data-[state=checked]:ring-offset-2 data-[state=checked]:ring-offset-white"
                checked={value.checked}
                onCheckedChange={(checked) => handleCheckedChange(Boolean(checked), value.id)}
              />
              <Input
                className="w-1/2"
                value={value.value}
                onChange={(e) => handleInputChange(e.target.value, value.id)}
              />
              <button
                type="button"
                className="col-span-1 mt-auto inline-flex h-10 w-10 items-center text-slate-500 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white"
                onClick={() => removeValue(value.id)}
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
            <Trans>Add another value</Trans>
          </Button>
        </div>
      )}
    </div>
  );
};
