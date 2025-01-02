import { ZRadioFieldMeta } from '@documenso/lib/types/field-meta';
import type { TRadioFieldMeta } from '@documenso/lib/types/field-meta';
import { Label } from '@documenso/ui/primitives/label';
import { RadioGroup, RadioGroupItem } from '@documenso/ui/primitives/radio-group';

import { FieldIcon } from '../field-icon';
import type { TDocumentFlowFormSchema } from '../types';

type Field = TDocumentFlowFormSchema['fields'][0];

export type RadioFieldProps = {
  field: Field;
};

export const RadioField = ({ field }: RadioFieldProps) => {
  let parsedFieldMeta: TRadioFieldMeta | undefined = undefined;

  if (field.fieldMeta) {
    parsedFieldMeta = ZRadioFieldMeta.parse(field.fieldMeta);
  }

  if (parsedFieldMeta && (!parsedFieldMeta.values || parsedFieldMeta.values.length === 0)) {
    return <FieldIcon fieldMeta={field.fieldMeta} type={field.type} />;
  }

  return (
    <div className="flex flex-col gap-y-2">
      {!parsedFieldMeta?.values ? (
        <FieldIcon fieldMeta={field.fieldMeta} type={field.type} />
      ) : (
        <RadioGroup className="gap-y-1">
          {parsedFieldMeta.values?.map((item, index) => (
            <div key={index} className="flex items-center gap-x-1.5">
              <RadioGroupItem
                className="dark:border-field-border pointer-events-none h-3 w-3"
                value={item.value}
                id={`option-${index}`}
                checked={item.checked}
              />
              <Label htmlFor={`option-${index}`} className="text-xs font-normal text-black">
                {item.value}
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}
    </div>
  );
};
