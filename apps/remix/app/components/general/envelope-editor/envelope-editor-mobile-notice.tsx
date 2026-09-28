import { Button } from '@documenso/ui/primitives/button';
import { Trans } from '@lingui/react/macro';
import { MonitorIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

const DISMISSED_STORAGE_KEY = 'envelopeEditorMobileNoticeDismissed';

// Storage access can throw when the browser blocks it (privacy settings, some
// embedded contexts). A cosmetic notice must never take the editor down, so
// failures are treated as "not dismissed" and the dismissal is not persisted.
const readIsDismissed = () => {
  try {
    return localStorage.getItem(DISMISSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

const persistDismissed = () => {
  try {
    localStorage.setItem(DISMISSED_STORAGE_KEY, 'true');
  } catch {
    return;
  }
};

/**
 * Suggests using a larger screen for the editor. Only shown below the `md`
 * breakpoint, and stays hidden once dismissed.
 */
export const EnvelopeEditorMobileNotice = () => {
  // Hidden until mounted so the server and first client render agree, and so a
  // previously dismissed notice never flashes.
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(!readIsDismissed());
  }, []);

  const onDismiss = () => {
    setIsVisible(false);

    persistDismissed();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="flex shrink-0 items-center gap-3 border-border border-b bg-muted/50 px-4 py-2 text-muted-foreground text-sm md:hidden">
      <MonitorIcon className="h-4 w-4 shrink-0" aria-hidden />

      <p className="flex-1">
        <Trans>For the best experience, use the editor on a desktop.</Trans>
      </p>

      <Button variant="ghost" size="sm" className="-mr-2 h-8 w-8 shrink-0 p-0" onClick={onDismiss}>
        <XIcon className="h-4 w-4" />
        <span className="sr-only">
          <Trans>Close</Trans>
        </span>
      </Button>
    </div>
  );
};
