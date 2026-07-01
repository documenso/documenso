import type { TTagLite } from '@documenso/lib/types/tag';
import { Link } from 'react-router';

import { TagBadge } from './tag-badge';

export type TagListProps = {
  tags: TTagLite[];
  maxVisible?: number;
  getTagHref?: (tag: TTagLite) => string;
};

export const TagList = ({ tags, maxVisible = 3, getTagHref }: TagListProps) => {
  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="flex max-w-[12rem] flex-wrap gap-1">
      {tags.slice(0, maxVisible).map((tag) =>
        getTagHref ? (
          <Link key={tag.id} to={getTagHref(tag)}>
            <TagBadge tag={tag} />
          </Link>
        ) : (
          <TagBadge key={tag.id} tag={tag} />
        ),
      )}

      {tags.length > maxVisible && <span className="text-muted-foreground text-xs">+{tags.length - maxVisible}</span>}
    </div>
  );
};
