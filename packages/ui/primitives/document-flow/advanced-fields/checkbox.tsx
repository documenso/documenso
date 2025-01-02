import { ZCheckboxFieldMeta } from '@documenso/lib/types/field-meta';
import type { TCheckboxFieldMeta } from '@documenso/lib/types/field-meta';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import { Label } from '@documenso/ui/primitives/label';

import { FieldIcon } from '../field-icon';
import type { TDocumentFlowFormSchema } from '../types';

type Field = TDocumentFlowFormSchema['fields'][0];

export type CheckboxFieldProps = {
  field: Field;
};

export const CheckboxField = ({ field }: CheckboxFieldProps) => {
  let parsedFieldMeta: TCheckboxFieldMeta | undefined = undefined;

  if (field.fieldMeta) {
    parsedFieldMeta = ZCheckboxFieldMeta.parse(field.fieldMeta);
  }

  if (parsedFieldMeta && (!parsedFieldMeta.values || parsedFieldMeta.values.length === 0)) {
    return <FieldIcon fieldMeta={field.fieldMeta} type={field.type} />;
  }

  return (
    <div className="flex flex-col gap-y-1">
      {!parsedFieldMeta?.values ? (
        <FieldIcon fieldMeta={field.fieldMeta} type={field.type} />
      ) : (
        parsedFieldMeta.values.map((item: { value: string; checked: boolean }, index: number) => (
          <div key={index} className="flex items-center gap-x-1.5">
            <Checkbox
              className="dark:border-field-border h-3 w-3 bg-white"
              id={`checkbox-${index}`}
              checked={item.checked}
            />
            <Label htmlFor={`checkbox-${index}`} className="text-xs font-normal text-black">
              {item.value}
            </Label>
          </div>
        ))
      )}
    </div>
  );
};
