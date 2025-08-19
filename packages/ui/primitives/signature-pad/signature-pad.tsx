import type { HTMLAttributes } from 'react';
import { useState } from 'react';

import { Keyboard, KeyboardIcon, UploadCloudIcon } from 'lucide-react';
import { match } from 'ts-pattern';

import { DocumentSignatureType } from '@documenso/lib/constants/document';
import { isBase64Image } from '@documenso/lib/constants/signatures';

import { SignatureIcon } from '../../icons/signature';
import { cn } from '../../lib/utils';
import { SignaturePadDraw } from './signature-pad-draw';
import { SignaturePadKeyboard } from './signature-pad-keyboard';
import { SignaturePadType } from './signature-pad-type';
import { SignaturePadUpload } from './signature-pad-upload';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './signature-tabs';

export type SignaturePadValue = {
  type: DocumentSignatureType;
  value: string;
};

export type SignaturePadProps = Omit<HTMLAttributes<HTMLCanvasElement>, 'onChange'> & {
  value?: string;
  onChange?: (_value: SignaturePadValue) => void;

  disabled?: boolean;

  typedSignatureEnabled?: boolean;
  uploadSignatureEnabled?: boolean;
  drawSignatureEnabled?: boolean;
  keyboardSignatureEnabled?: boolean;

  onValidityChange?: (isValid: boolean) => void;
};

export const SignaturePad = ({
  value = '',
  onChange,
  disabled = false,
  typedSignatureEnabled = true,
  uploadSignatureEnabled = true,
  drawSignatureEnabled = true,
  keyboardSignatureEnabled = true,
}: SignaturePadProps) => {
  const [imageSignature, setImageSignature] = useState(isBase64Image(value) ? value : '');
  const [drawSignature, setDrawSignature] = useState(isBase64Image(value) ? value : '');
  const [typedSignature, setTypedSignature] = useState(isBase64Image(value) ? '' : value);
  const [keyboardSignature, setKeyboardSignature] = useState(isBase64Image(value) ? value : '');

  /**
   * This is cooked.
   *
   * Get the first enabled tab that has a signature if possible, otherwise just get
   * the first enabled tab.
   */
  const [tab, setTab] = useState(
    ((): 'draw' | 'text' | 'image' | 'keyboard' => {
      // First passthrough to check to see if there's a signature for a given tab.
      if (drawSignatureEnabled && drawSignature) {
        return 'draw';
      }

      if (typedSignatureEnabled && typedSignature) {
        return 'text';
      }

      if (uploadSignatureEnabled && imageSignature) {
        return 'image';
      }

      if (keyboardSignatureEnabled && keyboardSignature) {
        return 'keyboard';
      }

      // Second passthrough to just select the first avaliable tab.
      if (drawSignatureEnabled) {
        return 'draw';
      }

      if (typedSignatureEnabled) {
        return 'text';
      }

      if (uploadSignatureEnabled) {
        return 'image';
      }

      if (keyboardSignatureEnabled) {
        return 'keyboard';
      }

      throw new Error('No signature enabled');
    })(),
  );

  const onImageSignatureChange = (value: string) => {
    setImageSignature(value);

    onChange?.({
      type: DocumentSignatureType.UPLOAD,
      value,
    });
  };

  const onDrawSignatureChange = (value: string) => {
    setDrawSignature(value);

    onChange?.({
      type: DocumentSignatureType.DRAW,
      value,
    });
  };

  const onTypedSignatureChange = (value: string) => {
    setTypedSignature(value);

    onChange?.({
      type: DocumentSignatureType.TYPE,
      value,
    });
  };

  const onKeyboardSignatureChange = (value: string) => {
    setKeyboardSignature(value);

    onChange?.({
      type: DocumentSignatureType.KEYBOARD,
      value,
    });
  };

  const onTabChange = (value: 'draw' | 'text' | 'image' | 'keyboard') => {
    if (disabled) {
      return;
    }

    setTab(value);

    match(value)
      .with('draw', () => {
        onDrawSignatureChange(drawSignature);
      })
      .with('text', () => {
        onTypedSignatureChange(typedSignature);
      })
      .with('image', () => {
        onImageSignatureChange(imageSignature);
      })
      .with('keyboard', () => {
        onKeyboardSignatureChange(keyboardSignature);
      })
      .exhaustive();
  };

  if (
    !drawSignatureEnabled &&
    !typedSignatureEnabled &&
    !uploadSignatureEnabled &&
    !keyboardSignatureEnabled
  ) {
    return null;
  }

  return (
    <Tabs
      defaultValue={tab}
      className={cn({
        'pointer-events-none': disabled,
      })}
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      onValueChange={(value) => onTabChange(value as 'draw' | 'text' | 'image' | 'keyboard')}
    >
      <TabsList>
        {drawSignatureEnabled && (
          <TabsTrigger value="draw">
            <SignatureIcon className="mr-2 size-4" />
            Draw
          </TabsTrigger>
        )}

        {typedSignatureEnabled && (
          <TabsTrigger value="text">
            <KeyboardIcon className="mr-2 size-4" />
            Type
          </TabsTrigger>
        )}

        {uploadSignatureEnabled && (
          <TabsTrigger value="image">
            <UploadCloudIcon className="mr-2 size-4" />
            Upload
          </TabsTrigger>
        )}

        {keyboardSignatureEnabled && (
          <TabsTrigger value="keyboard">
            <Keyboard className="mr-2 size-4" />
            Keyboard
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent
        value="draw"
        className="border-border aspect-signature-pad dark:bg-background relative flex items-center justify-center rounded-md border bg-neutral-50 text-center"
      >
        <SignaturePadDraw
          className="h-full w-full"
          onChange={onDrawSignatureChange}
          value={drawSignature}
        />
      </TabsContent>

      <TabsContent
        value="text"
        className="border-border aspect-signature-pad dark:bg-background relative flex items-center justify-center rounded-md border bg-neutral-50 text-center"
      >
        <SignaturePadType value={typedSignature} onChange={onTypedSignatureChange} />
      </TabsContent>

      <TabsContent
        value="image"
        className={cn(
          'border-border aspect-signature-pad dark:bg-background relative rounded-md border bg-neutral-50',
          {
            'bg-white': imageSignature,
          },
        )}
      >
        <SignaturePadUpload value={imageSignature} onChange={onImageSignatureChange} />
      </TabsContent>

      <TabsContent
        value="keyboard"
        className="border-border aspect-signature-pad dark:bg-background relative flex items-center justify-center rounded-md border bg-neutral-50 text-center"
      >
        <SignaturePadKeyboard value={keyboardSignature} onChange={onKeyboardSignatureChange} />
      </TabsContent>
    </Tabs>
  );
};
