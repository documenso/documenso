import { ZCheckboxFieldMeta } from '@documenso/lib/types/field-meta';
import type { TCheckboxFieldMeta } from '@documenso/lib/types/field-meta';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';
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
    return (
      <FieldIcon fieldMeta={field.fieldMeta} type={field.type} signerEmail={field.signerEmail} />
    );
  }

  return (
    <div>
      {!parsedFieldMeta?.values ? (
        <FieldIcon fieldMeta={field.fieldMeta} type={field.type} signerEmail={field.signerEmail} />
      ) : (
        parsedFieldMeta.values.map((item: { value: string; checked: boolean }, index: number) => (
          <Card
            id={String(index)}
            key={index}
            className={cn('my-2 p-2', {
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
              <Checkbox
                className="data-[state=checked]:bg-documenso h-5 w-5"
                checkClassName="text-white"
                id={`checkbox-${index}`}
                checked={item.checked}
              />
              <Label htmlFor={`checkbox-${index}`}>{item.value}</Label>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};
