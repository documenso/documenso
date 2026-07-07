import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import { getRecipientType } from '@documenso/lib/client-only/recipient-type';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import type { TRecipientLite } from '@documenso/lib/types/recipient';
import { recipientAbbreviation } from '@documenso/lib/utils/recipient-formatter';
import { cn } from '@documenso/ui/lib/utils';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { DocumentStatus } from '@prisma/client';
import { CopyIcon } from 'lucide-react';

import { StackAvatar } from './stack-avatar';

export type AvatarWithRecipientProps = {
  recipient: TRecipientLite;
  documentStatus: DocumentStatus;
};

export function AvatarWithRecipient({ recipient, documentStatus }: AvatarWithRecipientProps) {
  const [, copy] = useCopyToClipboard();

  const { _ } = useLingui();
  const { toast } = useToast();

  const signingToken = documentStatus === DocumentStatus.PENDING ? recipient.token : null;

  const onRecipientClick = () => {
    if (!signingToken) {
      return;
    }

    void copy(`${NEXT_PUBLIC_WEBAPP_URL()}/sign/${signingToken}`).then(() => {
      toast({
        title: _(msg`Copied to clipboard`),
        description: _(msg`The signing link has been copied to your clipboard.`),
      });
    });
  };

  return (
    <div
      className={cn('-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5', {
        'group cursor-pointer hover:bg-muted': signingToken,
      })}
      role={signingToken ? 'button' : undefined}
      title={signingToken ? _(msg`Click to copy signing link for sending to recipient`) : undefined}
      onClick={onRecipientClick}
    >
      <StackAvatar
        first={true}
        key={recipient.id}
        type={getRecipientType(recipient)}
        fallbackText={recipientAbbreviation(recipient)}
        className="h-8 w-8 shrink-0 border-0 text-xs"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground text-sm">{recipient.email || recipient.name}</p>
        <p className="truncate text-muted-foreground text-xs">
          {_(RECIPIENT_ROLES_DESCRIPTION[recipient.role].roleName)}
        </p>
      </div>

      {signingToken && (
        <CopyIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
      )}
    </div>
  );
}
