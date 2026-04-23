import { useCallback, useEffect, useRef, useState } from 'react';

import { Trans } from '@lingui/react/macro';
import { DocumentStatus } from '@prisma/client';
import { EyeOffIcon } from 'lucide-react';

import { getBoundingClientRect } from '@documenso/lib/client-only/get-bounding-client-rect';
import { useDocumentElement } from '@documenso/lib/client-only/hooks/use-document-element';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { cn } from '@documenso/ui/lib/utils';

const DEFAULT_WIDTH_PX = 60;
const DEFAULT_HEIGHT_PX = 20;

type Props = {
  selectedEnvelopeItemId: string | null;
};

export const EnvelopeEditorRedactionDragDrop = ({ selectedEnvelopeItemId }: Props) => {
  const { envelope, editorRedactions } = useCurrentEnvelopeEditor();
  const { isWithinPageBounds, getPage } = useDocumentElement();

  const isDisabled = envelope.status !== DocumentStatus.DRAFT;

  const [isActive, setIsActive] = useState(false);
  const [isWithinBounds, setIsWithinBounds] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const bounds = useRef({ width: DEFAULT_WIDTH_PX, height: DEFAULT_HEIGHT_PX });

  const onMouseMove = useCallback(
    (event: MouseEvent) => {
      setIsWithinBounds(
        isWithinPageBounds(
          event,
          PDF_VIEWER_PAGE_SELECTOR,
          bounds.current.width,
          bounds.current.height,
        ),
      );
      setCoords({
        x: event.clientX - bounds.current.width / 2,
        y: event.clientY - bounds.current.height / 2,
      });
    },
    [isWithinPageBounds],
  );

  const onMouseClick = useCallback(
    (event: MouseEvent) => {
      if (!isActive || !selectedEnvelopeItemId) {
        return;
      }

      const $page = getPage(event, PDF_VIEWER_PAGE_SELECTOR);

      if (
        !$page ||
        !isWithinPageBounds(
          event,
          PDF_VIEWER_PAGE_SELECTOR,
          bounds.current.width,
          bounds.current.height,
        )
      ) {
        setIsActive(false);
        return;
      }

      const { top, left, height, width } = getBoundingClientRect($page);
      const pageNumber = parseInt($page.getAttribute('data-page-number') ?? '1', 10);

      let pageX = ((event.pageX - left) / width) * 100;
      let pageY = ((event.pageY - top) / height) * 100;

      const redactionPageWidth = (bounds.current.width / width) * 100;
      const redactionPageHeight = (bounds.current.height / height) * 100;

      pageX -= redactionPageWidth / 2;
      pageY -= redactionPageHeight / 2;

      editorRedactions.addRedaction({
        envelopeItemId: selectedEnvelopeItemId,
        page: pageNumber,
        positionX: pageX,
        positionY: pageY,
        width: redactionPageWidth,
        height: redactionPageHeight,
      });

      setIsWithinBounds(false);
      setIsActive(false);
    },
    [isActive, selectedEnvelopeItemId, getPage, isWithinPageBounds, editorRedactions],
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseClick);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseClick);
    };
  }, [isActive, onMouseMove, onMouseClick]);

  return (
    <>
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => setIsActive(true)}
        onMouseDown={() => setIsActive(true)}
        data-selected={isActive ? true : undefined}
        className={cn(
          'group flex h-12 w-full cursor-pointer items-center justify-center gap-x-1.5 rounded-lg border border-border px-4 transition-colors',
          'data-[selected=true]:border-foreground data-[selected=true]:bg-foreground data-[selected=true]:text-background',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <EyeOffIcon className="h-4 w-4" />
        <span className="font-noto text-sm font-normal">
          <Trans>Redact</Trans>
        </span>
      </button>

      {isActive && (
        <div
          className={cn(
            'pointer-events-none fixed z-50 flex items-center justify-center rounded-sm bg-black text-white transition duration-200',
            {
              '-rotate-6 scale-90 opacity-50': !isWithinBounds,
            },
          )}
          style={{
            top: coords.y,
            left: coords.x,
            width: bounds.current.width,
            height: bounds.current.height,
          }}
        >
          <span className="text-[10px] font-medium tracking-wider">
            <Trans>REDACTED</Trans>
          </span>
        </div>
      )}
    </>
  );
};
