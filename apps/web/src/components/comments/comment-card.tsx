import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

import { LocaleDate } from '~/components/formatter/locale-date';

export type CommentCardProps = {
  comment: any;
  className?: string;
};

export const CommentCard = ({ comment, className }: CommentCardProps) => {
  return (
    <div className={cn('mb-8', className)} key={comment.id}>
      <p className="font-semibold">{comment.User.name}</p>
      <p className="text-sm">
        <LocaleDate
          date={comment.createdAt}
          format={{
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          }}
        />
      </p>
      <p className="mb-2 mt-2 text-base">{comment.comment}</p>
      <Button>Reply</Button>
    </div>
  );
};
