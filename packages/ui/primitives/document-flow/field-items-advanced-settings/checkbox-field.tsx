import { useEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { ChevronDown, ChevronUp, Trash } from 'lucide-react';

import { validateCheckboxField } from '@documenso/lib/advanced-fields-validation/validate-checkbox';
import { type TCheckboxFieldMeta as CheckboxFieldMeta } from '@documenso/lib/types/field-meta';
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

import { checkboxValidationLength, checkboxValidationRules } from './constants';

type CheckboxFieldAdvancedSettingsProps = {
  fieldState: CheckboxFieldMeta;
  handleFieldChange: (
    key: keyof CheckboxFieldMeta,
    value: string | { checked: boolean; value: string }[] | boolean,
  ) => void;
  handleErrors: (errors: string[]) => void;
};

export const CheckboxFieldAdvancedSettings = ({
  fieldState,
  handleFieldChange,
  handleErrors,
}: CheckboxFieldAdvancedSettingsProps) => {
  const { _ } = useLingui();

  const [showValidation, setShowValidation] = useState(false);
  const [values, setValues] = useState(fieldState.values ?? [{ id: 1, checked: false, value: '' }]);
  const [readOnly, setReadOnly] = useState(fieldState.readOnly ?? false);
  const [required, setRequired] = useState(fieldState.required ?? false);
  const [validationLength, setValidationLength] = useState(fieldState.validationLength ?? 0);
  const [validationRule, setValidationRule] = useState(fieldState.validationRule ?? '');
  const [direction, setDirection] = useState<'vertical' | 'horizontal'>(
    fieldState.direction ?? 'vertical',
  );

  const handleToggleChange = (field: keyof CheckboxFieldMeta, value: string | boolean) => {
    const readOnly = field === 'readOnly' ? Boolean(value) : Boolean(fieldState.readOnly);
    const required = field === 'required' ? Boolean(value) : Boolean(fieldState.required);
    const validationRule =
      field === 'validationRule' ? String(value) : String(fieldState.validationRule);
    const validationLength =
      field === 'validationLength' ? Number(value) : Number(fieldState.validationLength);
    const currentDirection =
      field === 'direction' && String(value) === 'horizontal' ? 'horizontal' : 'vertical';

    setReadOnly(readOnly);
    setRequired(required);
    setValidationRule(validationRule);
    setValidationLength(validationLength);
    setDirection(currentDirection);

    const errors = validateCheckboxField(
      values.map((item) => item.value),
      {
        readOnly,
        required,
        validationRule,
        validationLength,
        direction: currentDirection,
        type: 'checkbox',
      },
    );
    handleErrors(errors);

    handleFieldChange(field, value);
  };

  const addValue = () => {
    const newId = values.length > 0 ? Math.max(...values.map((val) => val.id)) + 1 : 1;
    setValues([...values, { id: newId, checked: false, value: '' }]);
  };

  useEffect(() => {
    const errors = validateCheckboxField(
      values.map((item) => item.value),
      {
        readOnly,
        required,
        validationRule,
        validationLength,
        direction: direction,
        type: 'checkbox',
      },
    );
    handleErrors(errors);
    handleFieldChange('values', values);
  }, [values]);

  const removeValue = (index: number) => {
    if (values.length === 1) return;

    const newValues = [...values];
    newValues.splice(index, 1);
    setValues(newValues);
    handleFieldChange('values', newValues);
  };

  const handleCheckboxValue = (
    index: number,
    property: 'value' | 'checked',
    newValue: string | boolean,
  ) => {
    const newValues = [...values];

    if (property === 'checked') {
      newValues[index].checked = Boolean(newValue);
    } else if (property === 'value') {
      newValues[index].value = String(newValue);
    }

    setValues(newValues);
    handleFieldChange('values', newValues);
  };

  useEffect(() => {
    setValues(fieldState.values ?? [{ id: 1, checked: false, value: '' }]);
  }, [fieldState.values]);

  return (
    <div className="flex flex-col gap-4">
      <div className="mb-2">
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

      <div className="mb-2">
        <Label>
          <Trans>Direction</Trans>
        </Label>
        <Select
          value={fieldState.direction ?? 'vertical'}
          onValueChange={(val) => handleToggleChange('direction', val)}
        >
          <SelectTrigger className="text-muted-foreground bg-background mt-2 w-full">
            <SelectValue placeholder={_(msg`Select direction`)} />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="vertical">
              <Trans>Vertical</Trans>
            </SelectItem>
            <SelectItem value="horizontal">
              <Trans>Horizontal</Trans>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-row items-center gap-x-4">
        <div className="flex w-2/3 flex-col">
          <Label>
            <Trans>Validation</Trans>
          </Label>
          <Select
            value={fieldState.validationRule}
            onValueChange={(val) => handleToggleChange('validationRule', val)}
          >
            <SelectTrigger className="text-muted-foreground bg-background mt-2 w-full">
              <SelectValue placeholder={_(msg`Select at least`)} />
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
            onValueChange={(val) => handleToggleChange('validationLength', val)}
          >
            <SelectTrigger className="text-muted-foreground bg-background mt-2 w-full">
              <SelectValue placeholder={_(msg`Pick a number`)} />
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
            <Trans>Checkbox values</Trans>
          </span>
          {showValidation ? <ChevronUp /> : <ChevronDown />}
        </span>
      </Button>

      {showValidation && (
        <div>
          {values.map((value, index) => (
            <div key={index} className="mt-2 flex items-center gap-4">
              <Checkbox
                className="data-[state=checked]:bg-primary border-foreground/30 h-5 w-5"
                checked={value.checked}
                onCheckedChange={(checked) => handleCheckboxValue(index, 'checked', checked)}
              />
              <Input
                className="w-1/2"
                value={value.value}
                onChange={(e) => handleCheckboxValue(index, 'value', e.target.value)}
              />
              <button
                type="button"
                className="col-span-1 mt-auto inline-flex h-10 w-10 items-center text-slate-500 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => removeValue(index)}
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
