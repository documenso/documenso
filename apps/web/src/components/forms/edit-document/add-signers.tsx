'use client';

import React from 'react';

import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Trash } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Control, Controller, FieldErrors, UseFormWatch, useFieldArray } from 'react-hook-form';

import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';

import { FormErrorMessage } from '~/components/form/form-error-message';

import { TEditDocumentFormSchema } from './types';

export type AddSignersFormProps = {
  className?: string;
  control: Control<TEditDocumentFormSchema>;
  watch: UseFormWatch<TEditDocumentFormSchema>;
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
    append: appendSigner,
    fields: signers,
    remove: removeSigner,
  } = useFieldArray({
    control,
    name: 'signers',
  });

  const { remove: removeField, fields: fields } = useFieldArray({
    name: 'fields',
    control,
  });

  const onAddSigner = () => {
    appendSigner({
      formId: nanoid(12),
      name: '',
      email: '',
    });
  };

  const onRemoveSigner = (index: number) => {
    const signer = signers[index];

    removeSigner(index);

    const fieldsToRemove: number[] = [];

    fields.forEach((field, fieldIndex) => {
      if (field.signerEmail === signer.email) {
        fieldsToRemove.push(fieldIndex);
      }
    });

    removeField(fieldsToRemove);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      onAddSigner();
    }
  };

  return (
    <div className={cn('flex flex-col', className)}>
      <h3 className="text-foreground text-2xl font-semibold">Add Signers</h3>

      <p className="text-muted-foreground mt-2 text-sm">
        Add the people who will sign the document.
      </p>

      <hr className="border-border mb-8 mt-4" />

      <div className="-mx-2 flex flex-1 flex-col overflow-y-auto px-2">
        <div className="flex w-full flex-col gap-y-4">
          <AnimatePresence>
            {signers.map((signer, index) => (
              <motion.div key={signer.formId} className="flex flex-wrap items-end gap-x-4">
                <div className="flex-1">
                  <Label htmlFor={`signer-${signer.formId}-email`}>
                    Email
                    <span className="text-destructive ml-1 inline-block font-medium">*</span>
                  </Label>

                  <Controller
                    control={control}
                    name={`signers.${index}.email`}
                    render={({ field }) => (
                      <Input
                        id={`signer-${signer.formId}-email`}
                        type="email"
                        className="bg-background mt-2"
                        disabled={isSubmitting}
                        onKeyDown={onKeyDown}
                        {...field}
                      />
                    )}
                  />
                </div>

                <div className="flex-1">
                  <Label htmlFor={`signer-${signer.formId}-name`}>Name</Label>

                  <Controller
                    control={control}
                    name={`signers.${index}.name`}
                    render={({ field }) => (
                      <Input
                        id={`signer-${signer.formId}-name`}
                        type="text"
                        className="bg-background mt-2"
                        disabled={isSubmitting}
                        onKeyDown={onKeyDown}
                        {...field}
                      />
                    )}
                  />
                </div>

                <div>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center text-slate-500 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSubmitting || signers.length === 1}
                    onClick={() => onRemoveSigner(index)}
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

        <FormErrorMessage className="mt-2" error={errors.signers} />

        <div className="mt-4">
          <Button type="button" disabled={isSubmitting} onClick={() => onAddSigner()}>
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Add Signer
          </Button>
        </div>
      </div>
    </div>
  );
};
