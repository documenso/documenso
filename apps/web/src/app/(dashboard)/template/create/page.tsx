'use client';

import { useRouter } from 'next/navigation';

import { createDocumentData } from '@documenso/lib/server-only/document-data/create-document-data';
import { putFile } from '@documenso/lib/universal/upload/put-file';
import { trpc } from '@documenso/trpc/react';
import { DocumentDropzone } from '@documenso/ui/primitives/document-dropzone';
import { useToast } from '@documenso/ui/primitives/use-toast';

export default function TemplatePage() {
  const router = useRouter();
  const { toast } = useToast();

  const { mutateAsync: createTemplate } = trpc.template.createTemplate.useMutation();

  const onFileDrop = async (file: File) => {
    try {
      const { type, data } = await putFile(file);

      const { id: templateDocumentDataId } = await createDocumentData({
        type,
        data,
      });

      const { id } = await createTemplate({
        title: file.name,
        templateDocumentDataId,
      });

      toast({
        title: 'Template document uploaded',
        description:
          'Your document has been uploaded successfully. You will be redirected to the template page.',
        duration: 5000,
      });

      void router.push(`/templates/${id}`);
    } catch {
      toast({
        title: 'Something went wrong',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="mx-auto max-w-screen-xl px-4 md:px-8">
      <h1 className="mb-5 mt-2 truncate text-2xl font-semibold md:text-3xl">Create Template</h1>

      <div className="w-full gap-4">
        <div className="rounded-xl before:rounded-xl ">
          <DocumentDropzone className="h-[80vh] max-h-[60rem]" onDrop={onFileDrop} />
        </div>
      </div>
    </div>
  );
}
