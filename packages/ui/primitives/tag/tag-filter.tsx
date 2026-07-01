import type { TagType } from '@documenso/lib/types/tag-type';
import { trpc } from '@documenso/trpc/react';
import { Trans } from '@lingui/react/macro';
import { TagIcon } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Button } from '../button';
import { Checkbox } from '../checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';

import { TagBadge } from './tag-badge';

export type TagFilterProps = {
  type: (typeof TagType)[keyof typeof TagType];
};

export const TagFilter = ({ type }: TagFilterProps) => {
  const [searchParams] = useSearchParams();
  const [, setSearchParams] = useSearchParams();

  const { data: tags } = trpc.tag.findTags.useQuery({
    type,
    perPage: 100,
  });

  const selectedTagIds = searchParams.get('tagIds')?.split(',').filter(Boolean) ?? [];

  const toggleTag = (tagId: string) => {
    const newTagIds = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];

    setSearchParams(
      (prev) => {
        if (newTagIds.length > 0) {
          prev.set('tagIds', newTagIds.join(','));
        } else {
          prev.delete('tagIds');
        }
        return prev;
      },
      { preventScrollReset: true },
    );
  };

  if (!tags || tags.data.length === 0) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <TagIcon className="h-4 w-4" />
          <Trans>Tags</Trans>
          {selectedTagIds.length > 0 && (
            <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-primary-foreground text-xs">
              {selectedTagIds.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="max-h-64 overflow-y-auto p-2">
          {tags.data.map((tag) => (
            <label
              key={tag.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
            >
              <Checkbox checked={selectedTagIds.includes(tag.id)} onCheckedChange={() => toggleTag(tag.id)} />
              <TagBadge tag={tag} />
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
