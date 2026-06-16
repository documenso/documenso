import { AppError } from '@documenso/lib/errors/app-error';
import { base64 } from '@documenso/lib/universal/base64';
import { trpc } from '@documenso/trpc/react';
import type { TFontLibraryTarget } from '@documenso/trpc/server/font-router/schema';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { FileType2Icon, Trash2Icon, UploadIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { FontFaceStyles } from '~/components/general/font-face-styles';

type FontManagementFormProps = {
  target: TFontLibraryTarget;
};

const ACCEPTED_FONT_TYPES = '.ttf,.otf,font/ttf,font/otf,application/x-font-ttf,application/x-font-otf';

const canDeleteFontForTarget = (
  font: { userId: number | null; teamId: number | null; organisationId: string | null },
  target: TFontLibraryTarget,
) => {
  if (target.type === 'personal') {
    return Boolean(font.userId);
  }

  if (target.type === 'team') {
    return font.teamId === target.teamId;
  }

  return font.organisationId === target.organisationId;
};

export const FontManagementForm = ({ target }: FontManagementFormProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const trpcUtils = trpc.useUtils();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState('');

  const queryInput = useMemo(() => ({ target }), [target]);
  const { data: fonts = [], isLoading } = trpc.font.list.useQuery(queryInput);
  const { mutateAsync: uploadFont, isPending: isUploading } = trpc.font.upload.useMutation();
  const { mutateAsync: deleteFont, isPending: isDeleting } = trpc.font.delete.useMutation();

  const invalidateFonts = () => trpcUtils.font.list.invalidate(queryInput);

  const onUpload = async () => {
    if (!selectedFile) {
      return;
    }

    const bytes = new Uint8Array(await selectedFile.arrayBuffer());

    try {
      await uploadFont({
        target,
        fileName: selectedFile.name,
        displayName: displayName.trim() || undefined,
        mimeType: selectedFile.type || (selectedFile.name.toLowerCase().endsWith('.otf') ? 'font/otf' : 'font/ttf'),
        fileSize: selectedFile.size,
        bytes: base64.encode(bytes),
      });

      setSelectedFile(null);
      setDisplayName('');
      await invalidateFonts();

      toast({
        title: _(msg`Font uploaded`),
        description: _(msg`Your font has been added to the font library.`),
      });
    } catch (err) {
      const error = AppError.parseError(err);
      console.error(error);

      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`We were unable to upload this font.`),
        variant: 'destructive',
      });
    }
  };

  const onDelete = async (fontId: string) => {
    try {
      await deleteFont({ fontId });
      await invalidateFonts();

      toast({
        title: _(msg`Font deleted`),
        description: _(msg`The font has been removed from the library.`),
      });
    } catch (err) {
      const error = AppError.parseError(err);
      console.error(error);

      toast({
        title: _(msg`Unable to delete font`),
        description: _(msg`This font may still be used by one or more fields.`),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-border bg-background p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="font-medium text-sm" htmlFor="font-upload">
              <Trans>Upload font</Trans>
            </label>

            <Input
              id="font-upload"
              type="file"
              accept={ACCEPTED_FONT_TYPES}
              className="mt-2 h-auto p-2"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedFile(file);

                if (file && !displayName) {
                  setDisplayName(file.name.replace(/\.[^.]+$/, ''));
                }
              }}
            />
          </div>

          <div className="flex-1">
            <label className="font-medium text-sm" htmlFor="font-display-name">
              <Trans>Display name</Trans>
            </label>

            <Input
              id="font-display-name"
              value={displayName}
              maxLength={120}
              className="mt-2"
              placeholder={_(msg`Font display name`)}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>

          <Button type="button" disabled={!selectedFile || isUploading} loading={isUploading} onClick={onUpload}>
            <UploadIcon className="mr-2 h-4 w-4" />
            <Trans>Upload</Trans>
          </Button>
        </div>

        <p className="mt-2 text-muted-foreground text-sm">
          <Trans>Supported formats: TTF and OTF. Maximum file size is 5MB.</Trans>
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {isLoading && (
          <p className="text-muted-foreground text-sm">
            <Trans>Loading fonts...</Trans>
          </p>
        )}

        {!isLoading && fonts.length === 0 && (
          <div className="rounded-lg border border-border border-dashed p-8 text-center text-muted-foreground text-sm">
            <Trans>No custom fonts have been uploaded yet.</Trans>
          </div>
        )}

        {fonts.map((font) => {
          const owner = font.userId ? _(msg`Personal`) : font.teamId ? _(msg`Team`) : _(msg`Organisation`);
          const canDelete = canDeleteFontForTarget(font, target);

          return (
            <div
              key={font.id}
              className="flex flex-col gap-4 rounded-lg border border-border p-4 sm:flex-row sm:items-center"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                <FileType2Icon className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{font.name}</p>
                  <Badge variant="secondary">{owner}</Badge>
                </div>

                <p className="truncate text-muted-foreground text-sm">{font.fileName}</p>
                <p className="mt-2 text-xl" style={{ fontFamily: `"${font.id}", "${font.family}", sans-serif` }}>
                  <Trans>The quick brown fox jumps over the lazy dog</Trans>
                </p>
              </div>

              <FontFaceStyles fonts={[font]} />

              {canDelete && (
                <Button type="button" variant="outline" disabled={isDeleting} onClick={() => void onDelete(font.id)}>
                  <Trash2Icon className="mr-2 h-4 w-4" />
                  <Trans>Delete</Trans>
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
