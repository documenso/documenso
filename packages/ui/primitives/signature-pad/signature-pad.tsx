'use client';

import { useState, type HTMLAttributes } from "react";
import { cn } from "../../lib/utils";
import { base64 } from "@documenso/lib/universal/base64";
import { Tabs, TabsList, TabsTrigger } from "../tabs";
import { TabsContent } from "@radix-ui/react-tabs";
import { SignatureDropzone } from "../signature-dropzone";
import { SignatureIcon } from '@documenso/ui/icons/signature';
import {  UploadIcon } from "lucide-react";
import { DrawPad } from "./drawpad";
import { SignatureType } from "@prisma/client";
import { Button } from "../button";

export type SignaturePadProps = Omit<HTMLAttributes<HTMLCanvasElement>, 'onChange'> & {
  containerClassName?: string;
  signature: { value: string | null;type :SignatureType;}
  onChange?: (_signatureDataUrl: string | null, isUploaded: boolean) => void;
};

export const SignaturePad = ({
  className,
  containerClassName,
  onChange,
  signature,
  ...props
}: SignaturePadProps) => {
  const [uploadedFile, setUploadedFile] = useState<{ file: File; fileBase64: string} | null >();

  const onSignatureDrop = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64String = base64.encode(new Uint8Array(arrayBuffer));

      setUploadedFile({
        file,
        fileBase64: `data:image/png;base64,${base64String}`,
      });
      onChange?.(`data:image/png;base64,${base64String}`, true)
    }
    catch (error) {
      console.error(error);
    }
  };

  return (
    <div className={cn('relative block', containerClassName)}>
        <Tabs defaultValue={signature.type ?? undefined} className="overflow-x-auto">
          <TabsList className="m-2">
            <TabsTrigger value="DRAW">
              <SignatureIcon className="mr-2 inline-block h-4 w-4 text-muted-foreground" />
              Draw
            </TabsTrigger>
            <TabsTrigger value="UPLOAD">
              <UploadIcon className="mr-2 inline-block h-4 w-4 text-muted-foreground" />
              Upload
            </TabsTrigger>
          </TabsList>
          <TabsContent value={SignatureType.DRAW}>
            <DrawPad onChange={onChange} signature={signature} className={className} {...props}/>
          </TabsContent>
          <TabsContent value={SignatureType.UPLOAD}>
            <div className="my-3">
              {uploadedFile || (signature.type === SignatureType.UPLOAD && signature.value ) ? (
                <div className="m-2">
                <img src={uploadedFile?.fileBase64 ?? signature?.value ?? ''}  className="h-40 w-full rounded-lg border bg-background" />
                <Button className="mt-1" >
                  Remove
                </Button>
                </div>
              )
              : (
                <SignatureDropzone onDrop={onSignatureDrop} className={className} />
              )}

            </div>
          </TabsContent>
        </Tabs>      
    </div>
  );
};

