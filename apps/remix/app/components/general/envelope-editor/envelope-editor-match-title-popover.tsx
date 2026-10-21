import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { removePdfExtension } from '@documenso/lib/utils/envelope';
import { Button } from '@documenso/ui/primitives/button';
import { Popover, PopoverAnchor, PopoverContent } from '@documenso/ui/primitives/popover';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { Trans, useLingui } from '@lingui/react/macro';
import { ArrowRightIcon } from 'lucide-react';
import { useId, useRef, useState } from 'react';

export type EnvelopeItemMatchTitlePrompt = {
  envelopeItemId: string;
  currentTitle: string;
  newTitle: string;
};

export type EnvelopeItemMatchTitlePopoverProps = {
  prompt: EnvelopeItemMatchTitlePrompt | null;
  onClose: () => void;
  children: React.ReactNode;
};

/**
 * Asks below the envelope title whether to rename the envelope item to match it.
 *
 * Stays open while the user works elsewhere until it's answered, dismissed with Escape,
 * or the title is edited again.
 */
export const EnvelopeItemMatchTitlePopover = ({ prompt, onClose, children }: EnvelopeItemMatchTitlePopoverProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const { updateEnvelopeItemTitle } = useCurrentEnvelopeEditor();

  const titleId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [isRenaming, setIsRenaming] = useState(false);

  const onRename = async () => {
    if (!prompt) {
      return;
    }

    setIsRenaming(true);

    try {
      await updateEnvelopeItemTitle(prompt.envelopeItemId, prompt.newTitle);

      onClose();
    } catch (err) {
      console.error(err);

      toast({
        title: t`Failed to rename file`,
        description: t`Something went wrong while renaming the file.`,
        variant: 'destructive',
      });
    } finally {
      setIsRenaming(false);
    }
  };

  return (
    <Popover
      open={prompt !== null}
      onOpenChange={(open) => {
        if (!open && !isRenaming) {
          onClose();
        }
      }}
    >
      <PopoverAnchor asChild>
        <div ref={anchorRef} className="min-w-0 max-w-full shrink">
          {children}
        </div>
      </PopoverAnchor>

      {prompt && (
        <PopoverContent
          ref={contentRef}
          align="start"
          sideOffset={8}
          className="w-80"
          aria-labelledby={titleId}
          onOpenAutoFocus={(event) => {
            event.preventDefault();

            // The prompt opens while focus is still moving to whatever was clicked or tabbed to,
            // so only take focus once nothing else has it (e.g. after pressing Enter).
            requestAnimationFrame(() => {
              if (!document.activeElement || document.activeElement === document.body) {
                contentRef.current?.focus();
              }
            });
          }}
          onInteractOutside={(event) => {
            if (!(event.target instanceof Node) || !anchorRef.current?.contains(event.target)) {
              event.preventDefault();
            }
          }}
        >
          <p id={titleId} className="font-medium text-sm">
            <Trans>Rename the file too?</Trans>
          </p>

          <p className="mt-1 text-muted-foreground text-xs">
            <Trans>Downloads and email attachments use the file name, not the envelope title.</Trans>
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-muted/60 px-3 py-2 text-xs">
            <span className="break-all text-muted-foreground">{toFileName(prompt.currentTitle)}</span>
            <ArrowRightIcon className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
            <span className="break-all font-medium">{toFileName(prompt.newTitle)}</span>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={isRenaming} onClick={onClose}>
              <Trans>Keep file name</Trans>
            </Button>

            <Button type="button" size="sm" loading={isRenaming} onClick={() => void onRename()}>
              <Trans>Rename file</Trans>
            </Button>
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
};

const toFileName = (title: string) => `${removePdfExtension(title)}.pdf`;
