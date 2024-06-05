'use client';

import { Link2Icon } from 'lucide-react';

import { useCopyToClipboard } from '@documenso/lib/client-only/hooks/use-copy-to-clipboard';
import { formatDirectTemplatePath } from '@documenso/lib/utils/templates';
import { cn } from '@documenso/ui/lib/utils';
import { useToast } from '@documenso/ui/primitives/use-toast';

type TemplateDirectLinkBadgeProps = {
  token: string;
  enabled: boolean;
  className?: string;
};

export const TemplateDirectLinkBadge = ({
  token,
  enabled,
  className,
}: TemplateDirectLinkBadgeProps) => {
  const [, copy] = useCopyToClipboard();
  const { toast } = useToast();

  const onCopyClick = async (token: string) =>
    copy(formatDirectTemplatePath(token)).then(() => {
      toast({
        title: 'Copied to clipboard',
        description: 'The direct link has been copied to your clipboard',
      });
    });

  return (
    <button
      title="Copy direct link"
      className={cn(
        'flex flex-row items-center rounded border border-neutral-300 bg-neutral-200 px-1.5 py-0.5 text-xs dark:border-neutral-500 dark:bg-neutral-600',
        className,
      )}
      onClick={async () => onCopyClick(token)}
    >
      <Link2Icon className="mr-1 h-3 w-3" />
      direct link {!enabled && 'disabled'}
    </button>
  );
};
