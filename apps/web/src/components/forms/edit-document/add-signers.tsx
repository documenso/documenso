'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Trash } from 'lucide-react';
import { Control, Controller, FieldErrors, useFieldArray } from 'react-hook-form';

import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';

import { FormErrorMessage } from '~/components/form/form-error-message';

import { TEditDocumentFormSchema } from './types';

export type AddSignersFormProps = {
  className?: string;
  control: Control<TEditDocumentFormSchema>;
  errors: FieldErrors<TEditDocumentFormSchema>;
  isSubmitting: boolean;
};

export const AddSignersFormPartial = ({
  className,
  control,
  errors,
  isSubmitting,
}: AddSignersFormProps) => {
  const {
    append,
    fields: signers,
    remove,
  } = useFieldArray({
    control,
    name: 'signers',
  });

  return (
    <div className={cn('flex flex-col', className)}>
      <h3 className="text-2xl font-semibold">Add Signers</h3>

      <p className="mt-2 text-sm text-black/30">Add the people who will sign the document.</p>

      <hr className="mb-8 mt-4" />

      <div className="-mx-2 flex flex-1 flex-col overflow-y-scroll px-2">
        <div className="flex w-full flex-col gap-y-4">
          <AnimatePresence>
            {signers.map((field, index) => (
              <motion.div key={field.id} className="flex flex-wrap items-end gap-x-4">
                <div className="flex-1">
                  <Label htmlFor={`signer-${index}-email`}>Email</Label>

                  <Controller
                    control={control}
                    name={`signers.${index}.email`}
                    render={({ field }) => (
                      <Input
                        id={`signer-${index}-email`}
                        type="email"
                        className="mt-2 bg-white"
                        disabled={isSubmitting}
                        {...field}
                      />
                    )}
                  />
                </div>

                <div className="flex-1">
                  <Label htmlFor={`signer-${index}-name`}>Name</Label>

                  <Controller
                    control={control}
                    name={`signers.${index}.name`}
                    render={({ field }) => (
                      <Input
                        id={`signer-${index}-name`}
                        type="text"
                        className="mt-2 bg-white"
                        disabled={isSubmitting}
                        {...field}
                      />
                    )}
                  />
                </div>

                <div>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center text-slate-500 hover:opacity-80"
                    disabled={isSubmitting}
                    onClick={() => remove(index)}
                  >
                    <Trash className="h-5 w-5" />
                  </button>
                </div>

                <div className="w-full">
                  <FormErrorMessage className="mt-2" error={errors.signers?.[index]?.email} />
                  <FormErrorMessage className="mt-2" error={errors.signers?.[index]?.name} />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="mt-4">
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={() =>
              append({
                email: '',
                name: '',
              })
            }
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Add Signer
          </Button>
        </div>
      </div>
    </div>
  );
};
