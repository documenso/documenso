import type { TagType } from '@documenso/lib/types/tag-type';
import { trpc } from '@documenso/trpc/react';
import { TagInput } from '@documenso/ui/primitives/tag/tag-input';
import { Trans } from '@lingui/react/macro';
import { TagsIcon } from 'lucide-react';

export type EnvelopeTagsSectionProps = {
  envelopeId: string;
  type: (typeof TagType)[keyof typeof TagType];
};

export const EnvelopeTagsSection = ({ envelopeId, type }: EnvelopeTagsSectionProps) => {
  const { data: assignedTags } = trpc.tag.getEnvelopeTags.useQuery({ envelopeId });

  return (
    <section className="flex flex-col rounded-xl border border-border bg-widget text-foreground dark:bg-background">
      <h1 className="flex items-center gap-2 px-4 py-3 font-medium">
        <TagsIcon className="h-4 w-4" />
        <Trans>Tags</Trans>
      </h1>

      <div className="border-t px-4 py-3">
        <TagInput type={type} envelopeId={envelopeId} assignedTags={assignedTags ?? []} />
      </div>
    </section>
  );
};
