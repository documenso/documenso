'use client';

import { useState } from 'react';

import { Caveat } from 'next/font/google';

import { Check, ChevronsUpDown } from 'lucide-react';
import { Control, FieldErrors, UseFormWatch } from 'react-hook-form';

import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@documenso/ui/primitives/command';
import { Popover, PopoverContent, PopoverTrigger } from '@documenso/ui/primitives/popover';

import { TEditDocumentFormSchema } from './types';

const fontCaveat = Caveat({
  weight: ['500'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-caveat',
});

export type AddFieldsFormProps = {
  className?: string;
  control: Control<TEditDocumentFormSchema>;
  watch: UseFormWatch<TEditDocumentFormSchema>;
  errors: FieldErrors<TEditDocumentFormSchema>;
  isSubmitting: boolean;
};

export const AddFieldsFormPartial = ({
  className,
  control: _control,
  watch,
  errors: _errors,
  isSubmitting: _isSubmitting,
}: AddFieldsFormProps) => {
  const signers = watch('signers');

  const [selectedSigner, setSelectedSigner] = useState(() => signers[0]);

  return (
    <div className={cn('flex flex-col', className)}>
      <h3 className="text-2xl font-semibold">Edit Document</h3>

      <p className="mt-2 text-sm text-black/30">Add all relevant fields for each recipient.</p>

      <hr className="mb-8 mt-4" />

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="justify-between bg-white font-normal text-slate-500"
          >
            {selectedSigner.name && (
              <span>
                {selectedSigner.name} ({selectedSigner.email})
              </span>
            )}

            {!selectedSigner.name && <span>{selectedSigner.email}</span>}

            <ChevronsUpDown className="ml-2 h-4 w-4" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="p-0" align="start">
          <Command>
            <CommandInput />
            <CommandEmpty />

            <CommandGroup>
              {signers.map((signer, index) => (
                <CommandItem key={index} onSelect={() => setSelectedSigner(signer)}>
                  <Check
                    className={cn('mr-2 h-4 w-4', {
                      'opacity-0': signer !== selectedSigner,
                      'opacity-100': signer === selectedSigner,
                    })}
                  />
                  {signer.name && (
                    <span>
                      {signer.name} ({signer.email})
                    </span>
                  )}

                  {!signer.name && <span>{signer.email}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      <div className="-mx-2 mt-8 flex-1 overflow-y-scroll px-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-8">
          <button className="group h-full w-full">
            <Card className="group-focus:border-primary h-full w-full cursor-pointer">
              <CardContent className="flex flex-col items-center justify-center px-6 py-4">
                <p
                  className={cn(
                    'text-3xl font-medium text-slate-500 group-focus:text-slate-900',
                    fontCaveat.className,
                  )}
                >
                  {selectedSigner.name || 'Signature'}
                </p>

                <p className="mt-2 text-center text-xs text-slate-500">Signature</p>
              </CardContent>
            </Card>
          </button>

          <button className="group h-full w-full">
            <Card className="group-focus:border-primary h-full w-full cursor-pointer">
              <CardContent className="flex flex-col items-center justify-center px-6 py-4">
                <p className={cn('text-xl font-medium text-slate-500 group-focus:text-slate-900')}>
                  {'Email'}
                </p>

                <p className="mt-2 text-xs text-slate-500">Email</p>
              </CardContent>
            </Card>
          </button>

          <button className="group h-full w-full">
            <Card className="group-focus:border-primary h-full w-full cursor-pointer">
              <CardContent className="flex flex-col items-center justify-center px-6 py-4">
                <p className={cn('text-xl font-medium text-slate-500 group-focus:text-slate-900')}>
                  {'Name'}
                </p>

                <p className="mt-2 text-xs text-slate-500">Name</p>
              </CardContent>
            </Card>
          </button>

          <button className="group h-full w-full">
            <Card className="group-focus:border-primary h-full w-full cursor-pointer">
              <CardContent className="flex flex-col items-center justify-center px-6 py-4">
                <p className={cn('text-xl font-medium text-slate-500 group-focus:text-slate-900')}>
                  {'Date'}
                </p>

                <p className="mt-2 text-xs text-slate-500">Date</p>
              </CardContent>
            </Card>
          </button>
        </div>
      </div>
    </div>
  );
};
