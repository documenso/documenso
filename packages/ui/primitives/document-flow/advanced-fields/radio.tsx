import { ZRadioFieldMeta } from '@documenso/lib/types/field-meta';
import type { TRadioFieldMeta } from '@documenso/lib/types/field-meta';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';
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
    return (
      <FieldIcon fieldMeta={field.fieldMeta} type={field.type} signerEmail={field.signerEmail} />
    );
  }

  return (
    <div>
      {!parsedFieldMeta?.values ? (
        <FieldIcon fieldMeta={field.fieldMeta} type={field.type} signerEmail={field.signerEmail} />
      ) : (
        <RadioGroup>
          {parsedFieldMeta.values?.map((item, index) => (
            <Card
              id={String(index)}
              key={index}
              className={cn('m-1 flex items-center justify-center p-2', {
                'border-documenso ring-documenso-200 ring-offset-documenso-200 bg-documenso/20 ring-2 ring-offset-2':
                  item.checked,
              })}
            >
              <CardContent
                className={cn(
                  'text-muted-foreground hover:shadow-primary-foreground group flex h-full w-full flex-row items-center space-x-2 p-2',
                  {
                    'hover:text-foreground/80 dark:text-background/70': item.checked,
                  },
                )}
              >
                <RadioGroupItem
                  className="data-[state=checked]:bg-documenso border-foreground/30 data-[state=checked]:ring-documenso h-5 w-5 rounded-full data-[state=checked]:ring-1 data-[state=checked]:ring-offset-2 data-[state=checked]:ring-offset-white dark:data-[state=checked]:ring-offset-white"
                  value={item.value}
                  id={`option-${index}`}
                  checked={item.checked}
                />
                <Label htmlFor={`option-${index}`}>{item.value}</Label>
              </CardContent>
            </Card>
          ))}
        </RadioGroup>
      )}
    </div>
  );
};
