import type { TTagLite } from '@documenso/lib/types/tag';
import type { TagType } from '@documenso/lib/types/tag-type';
import { trpc } from '@documenso/trpc/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { PlusIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../button';
import { Input } from '../input';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';
import { TagBadge } from './tag-badge';

export type TagInputProps = {
  type: (typeof TagType)[keyof typeof TagType];
  envelopeId: string;
  assignedTags: TTagLite[];
  className?: string;
};

export const TagInput = ({ type, envelopeId, assignedTags, className }: TagInputProps) => {
  const { t } = useLingui();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const utils = trpc.useUtils();

  const { data: tagsData } = trpc.tag.findTags.useQuery({
    type,
    perPage: 100,
  });

  const createTagMutation = trpc.tag.createTag.useMutation({
    onSuccess: () => {
      void utils.tag.findTags.invalidate();
    },
  });

  const setEnvelopeTagsMutation = trpc.tag.setEnvelopeTags.useMutation({
    onSuccess: () => {
      void utils.tag.getEnvelopeTags.invalidate({ envelopeId });
    },
  });

  const allTags = tagsData?.data ?? [];
  const assignedTagIds = new Set(assignedTags.map((t) => t.id));
  const availableTags = allTags.filter((t) => !assignedTagIds.has(t.id));
  const filteredTags = search
    ? availableTags.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : availableTags;

  const exactMatch = allTags.find((t) => t.name.toLowerCase() === search.toLowerCase().trim());
  const canCreate = search.trim().length > 0 && !exactMatch;

  const handleAssignTag = (tagId: string) => {
    setEnvelopeTagsMutation.mutate({
      envelopeId,
      tagIds: [...assignedTagIds, tagId],
    });
    setSearch('');
    setOpen(false);
  };

  const handleUnassignTag = (tagId: string) => {
    setEnvelopeTagsMutation.mutate({
      envelopeId,
      tagIds: assignedTags.filter((t) => t.id !== tagId).map((t) => t.id),
    });
  };

  const handleCreateAndAssign = async () => {
    const tag = await createTagMutation.mutateAsync({
      name: search.trim(),
      type,
    });

    handleAssignTag(tag.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canCreate) {
      e.preventDefault();
      void handleCreateAndAssign();
    }
  };

  const isMutating = createTagMutation.isPending || setEnvelopeTagsMutation.isPending;

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {assignedTags.map((tag) => (
        <TagBadge key={tag.id} tag={tag} className="gap-1 pr-1">
          <button
            type="button"
            onClick={() => handleUnassignTag(tag.id)}
            className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
            aria-label={t`Remove ${tag.name}`}
          >
            <XIcon className="h-3 w-3" />
          </button>
        </TagBadge>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs" disabled={isMutating}>
            <PlusIcon className="h-3 w-3" />
            <Trans>Add tag</Trans>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <div className="flex flex-col">
            <Input
              placeholder={t`Search or create tag...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-9 rounded-none border-0 border-b focus-visible:ring-0"
              autoFocus
            />

            <div className="max-h-48 overflow-y-auto p-1">
              {filteredTags.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  {filteredTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleAssignTag(tag.id)}
                      className="flex items-center rounded-md px-2 py-1.5 text-left hover:bg-accent"
                    >
                      <TagBadge tag={tag} />
                    </button>
                  ))}
                </div>
              )}

              {canCreate && (
                <button
                  type="button"
                  onClick={() => void handleCreateAndAssign()}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>
                    <Trans>Create "{search.trim()}"</Trans>
                  </span>
                </button>
              )}

              {filteredTags.length === 0 && !canCreate && (
                <div className="px-2 py-3 text-muted-foreground text-sm">
                  <Trans>No tags found</Trans>
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
