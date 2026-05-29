import { type TSignatureFieldMeta as SignatureFieldMeta } from '@documenso/lib/types/field-meta';

import { ShowLineSetting } from './show-line-setting';

type SignatureFieldAdvancedSettingsProps = {
  fieldState: SignatureFieldMeta;
  handleFieldChange: (key: keyof SignatureFieldMeta, value: string | boolean) => void;
  handleErrors: (errors: string[]) => void;
};

export const SignatureFieldAdvancedSettings = ({
  fieldState,
  handleFieldChange,
}: SignatureFieldAdvancedSettingsProps) => {
  return (
    <div className="flex flex-col gap-4">
      <ShowLineSetting
        checked={Boolean(fieldState.showLine)}
        onChange={(checked) => handleFieldChange('showLine', checked)}
      />
    </div>
  );
};
