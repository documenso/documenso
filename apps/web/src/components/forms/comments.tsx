'use client';

import { CornerDownRight } from 'lucide-react';

import { trpc } from '@documenso/trpc/react';

import { CommentCard } from '~/components/comments/comment-card';

export const Comments = () => {
  const { data: comments } = trpc.comment.getComments.useQuery();

  console.log(comments);
  return (
    <div>
      {comments?.map((comment) => (
        <div key={comment.id}>
          <CommentCard comment={comment} className="mb-8" />
          {comment.replies && comment.replies.length > 0 ? (
            <div>
              {comment.replies.map((reply) => (
                <div className="ml-6 flex" key={reply.id}>
                  <CornerDownRight className="flex shrink-0" />
                  <CommentCard comment={reply} className="ml-6" />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
};
