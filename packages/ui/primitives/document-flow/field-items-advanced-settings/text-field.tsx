import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { Switch } from '@documenso/ui/primitives/switch';
import { Textarea } from '@documenso/ui/primitives/textarea';

import type { FieldMeta } from '.././field-item-advanced-settings';

type TextFieldAdvancedSettingsProps = {
  fieldState: FieldMeta;
  handleFieldChange: (key: keyof FieldMeta, value: string) => void;
  handleToggleChange: (key: keyof FieldMeta) => void;
};

export const TextFieldAdvancedSettings = ({
  fieldState,
  handleFieldChange,
  handleToggleChange,
}: TextFieldAdvancedSettingsProps) => (
  <div className="flex flex-col gap-4">
    <div>
      <Label>Label</Label>
      <Input
        id="label"
        className="bg-background mt-2"
        placeholder="Field label"
        value={fieldState.label}
        onChange={(e) => handleFieldChange('label', e.target.value)}
      />
    </div>
    <div>
      <Label className="mt-4">Placeholder</Label>
      <Input
        id="placeholder"
        className="bg-background mt-2"
        placeholder="Field placeholder"
        value={fieldState.placeholder}
        onChange={(e) => handleFieldChange('placeholder', e.target.value)}
      />
    </div>

    <div>
      <Label className="mt-4">Add text</Label>
      <Textarea
        id="add-text"
        className="bg-background mt-2"
        placeholder="Add text to the field"
        value={fieldState.textField?.addText}
        onChange={(e) => handleFieldChange('characterLimit', e.target.value)}
      />
    </div>

    <div>
      <Label>Character Limit</Label>
      <Input
        id="characterLimit"
        className="bg-background mt-2"
        placeholder="Field character limit"
        value={fieldState.characterLimit}
        onChange={(e) => handleFieldChange('characterLimit', e.target.value)}
      />
    </div>

    <div className="mt-4 flex flex-col gap-4">
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
  </div>
);
