import { getBoundingClientRect } from '@documenso/lib/client-only/get-bounding-client-rect';
import { useDocumentElement } from '@documenso/lib/client-only/hooks/use-document-element';
import { useLatestRef } from '@documenso/lib/client-only/hooks/use-latest-ref';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import {
  CONTENT_LINE_META_DEFAULT_VALUES,
  CONTENT_META_DEFAULT_VALUES,
  CONTENT_SHAPE_META_DEFAULT_VALUES,
  CONTENT_TYPE_DATA_CONTENT_KIND,
  ContentShapeType,
  EnvelopeContentType,
  type TEnvelopeContentMetaOutput,
} from '@documenso/lib/types/envelope-content-meta';
import { CONTENT_IMAGE_DEFAULT_SIZE } from '@documenso/lib/universal/content-renderer/content-image-box';
import { canContentBeChanged } from '@documenso/lib/utils/envelope';
import { resolveEnvelopeContentLimits } from '@documenso/lib/utils/envelope-content';
import { getRecipientColorStyles } from '@documenso/ui/lib/recipient-colors';
import { cn } from '@documenso/ui/lib/utils';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { DocumentStatus } from '@prisma/client';
import type { LucideIcon } from 'lucide-react';
import { HighlighterIcon, ImageIcon, ScanLineIcon, SquareIcon, TextIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { match } from 'ts-pattern';

const MIN_HEIGHT_PX = 12;
const MIN_WIDTH_PX = 36;

const DEFAULT_HEIGHT_PX = MIN_HEIGHT_PX * 2.5;
const DEFAULT_WIDTH_PX = MIN_WIDTH_PX * 2.5;

/**
 * A content which can be placed from the palette. Shapes share the shape
 * content type and are told apart by `shape`.
 */
type ContentPaletteItem = {
  key: string;
  type: EnvelopeContentType;
  shape?: ContentShapeType;
  icon: LucideIcon;
  name: MessageDescriptor;
};

export const contentButtonList: ContentPaletteItem[] = [
  {
    key: EnvelopeContentType.TEXT,
    type: EnvelopeContentType.TEXT,
    icon: TextIcon,
    name: msg`Text`,
  },
  {
    key: EnvelopeContentType.LINE,
    type: EnvelopeContentType.LINE,
    icon: ScanLineIcon,
    name: msg`Line`,
  },
  {
    key: `${EnvelopeContentType.SHAPE}:${ContentShapeType.RECTANGLE}`,
    type: EnvelopeContentType.SHAPE,
    shape: ContentShapeType.RECTANGLE,
    icon: SquareIcon,
    name: msg`Rectangle`,
  },
  {
    key: EnvelopeContentType.HIGHLIGHT,
    type: EnvelopeContentType.HIGHLIGHT,
    icon: HighlighterIcon,
    name: msg`Highlight`,
  },
  {
    key: EnvelopeContentType.IMAGE,
    type: EnvelopeContentType.IMAGE,
    icon: ImageIcon,
    name: msg`Image`,
  },
];

type EnvelopeEditorContentDragDropProps = {
  selectedEnvelopeItemId: string | null;
};

export const EnvelopeEditorContentDragDrop = ({ selectedEnvelopeItemId }: EnvelopeEditorContentDragDropProps) => {
  const { envelope, editorContents } = useCurrentEnvelopeEditor();

  const organisation = useCurrentOrganisation();

  const { t } = useLingui();

  const contentLimits = resolveEnvelopeContentLimits(
    editorContents.localContents.map((content) => content.contentMeta.type),
    organisation.organisationClaim,
  );

  const [selectedContent, setSelectedContent] = useState<ContentPaletteItem | null>(null);

  const { isWithinPageBounds, getPage } = useDocumentElement();

  const [isContentWithinBounds, setIsContentWithinBounds] = useState(false);
  const [coords, setCoords] = useState({
    x: 0,
    y: 0,
  });

  const contentBounds = useRef({
    height: 0,
    width: 0,
  });

  const onMouseMove = useCallback(
    (event: MouseEvent) => {
      setIsContentWithinBounds(
        isWithinPageBounds(event, PDF_VIEWER_PAGE_SELECTOR, contentBounds.current.width, contentBounds.current.height),
      );

      setCoords({
        x: event.clientX - contentBounds.current.width / 2,
        y: event.clientY - contentBounds.current.height / 2,
      });
    },
    [isWithinPageBounds],
  );

  const onMouseClick = useCallback(
    (event: MouseEvent) => {
      if (!selectedContent || !selectedEnvelopeItemId) {
        return;
      }

      const $page = getPage(event, PDF_VIEWER_PAGE_SELECTOR);

      if (
        !$page ||
        !isWithinPageBounds(event, PDF_VIEWER_PAGE_SELECTOR, contentBounds.current.width, contentBounds.current.height)
      ) {
        setSelectedContent(null);
        return;
      }

      const { top, left, height, width } = getBoundingClientRect($page);

      const pageNumber = parseInt($page.getAttribute('data-page-number') ?? '1', 10);

      // Calculate x and y as a percentage of the page width and height
      let pageX = ((event.pageX - left) / width) * 100;
      let pageY = ((event.pageY - top) / height) * 100;

      // Get the bounds as a percentage of the page width and height
      const contentPageWidth = (contentBounds.current.width / width) * 100;
      const contentPageHeight = (contentBounds.current.height / height) * 100;

      // And center it based on the bounds
      pageX -= contentPageWidth / 2;
      pageY -= contentPageHeight / 2;

      editorContents.addContent({
        envelopeItemId: selectedEnvelopeItemId,
        contentMeta: buildContentMeta({
          item: selectedContent,
          page: pageNumber,
          positionX: pageX,
          positionY: pageY,
          width: contentPageWidth,
          height: contentPageHeight,
        }),
      });

      setIsContentWithinBounds(false);
      setSelectedContent(null);
    },
    [isWithinPageBounds, selectedContent, selectedEnvelopeItemId, getPage, editorContents],
  );

  const selectedContentRef = useLatestRef(selectedContent);

  useEffect(() => {
    const observer = new MutationObserver((_mutations) => {
      const $page = document.querySelector(PDF_VIEWER_PAGE_SELECTOR);

      if (!$page) {
        return;
      }

      contentBounds.current = resolveDragBounds(selectedContentRef.current, $page);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (selectedContent) {
      const $page = document.querySelector(PDF_VIEWER_PAGE_SELECTOR);

      if ($page) {
        contentBounds.current = resolveDragBounds(selectedContent, $page);
      }

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseClick);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseClick);
    };
  }, [onMouseClick, onMouseMove, selectedContent]);

  if (!canContentBeChanged(envelope)) {
    return (
      <Alert variant="neutral" className="rounded-lg border border-border">
        <AlertDescription className="text-sm">
          {match(envelope.status)
            .with(DocumentStatus.COMPLETED, () => (
              <Trans>This document has been completed, so its content can no longer be changed.</Trans>
            ))
            .with(DocumentStatus.REJECTED, () => (
              <Trans>This document has been rejected, so its content can no longer be changed.</Trans>
            ))
            .otherwise(() => (
              <Trans>Content cannot be changed because the document has already been sent.</Trans>
            ))}
        </AlertDescription>
      </Alert>
    );
  }

  // The organisation's plan caps how much content an envelope may hold. Only
  // adding is blocked: existing contents stay editable and removable so an
  // envelope which went over its limit can be brought back down.
  if (contentLimits.isContentLimitReached || contentLimits.isImageLimitReached) {
    return (
      <Alert variant="neutral" className="rounded-lg border border-border" data-testid="content-limit-reached-alert">
        <AlertDescription className="text-sm">
          {contentLimits.isContentLimitReached ? (
            <Plural
              value={contentLimits.contentLimit}
              one="This envelope cannot have more than # content. Remove some, or contact support if you need more."
              other="This envelope cannot have more than # contents. Remove some, or contact support if you need more."
            />
          ) : (
            <Plural
              value={contentLimits.imageLimit}
              one="This envelope cannot have more than # image content. Remove some, or contact support if you need more."
              other="This envelope cannot have more than # image contents. Remove some, or contact support if you need more."
            />
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-x-2 gap-y-2.5">
        {contentButtonList.map((content) => (
          <button
            key={content.key}
            type="button"
            onClick={() => setSelectedContent(content)}
            onMouseDown={() => setSelectedContent(content)}
            data-selected={selectedContent?.key === content.key ? true : undefined}
            className="group flex h-12 cursor-pointer items-center justify-center rounded-lg border border-border px-4 transition-colors"
          >
            <p className="flex items-center justify-center gap-x-1.5 font-normal font-noto text-muted-foreground text-sm group-data-[selected]:text-foreground">
              {<content.icon className="h-4 w-4" />}
              {t(content.name)}
            </p>
          </button>
        ))}
      </div>

      {selectedContent && (
        <div
          className={cn(
            'pointer-events-none fixed z-50 flex cursor-pointer flex-col items-center justify-center rounded-[2px] bg-white font-noto text-muted-foreground ring-2 transition duration-200 [container-type:size] dark:text-muted',
            // Match the brand green used for the first recipient's fields and
            // the rest of the content editor's selection affordances.
            getRecipientColorStyles('green').base,
            {
              '-rotate-6 scale-90 opacity-50 dark:bg-black/20': !isContentWithinBounds,
              'dark:text-black/60': isContentWithinBounds,
            },
          )}
          style={{
            top: coords.y,
            left: coords.x,
            height: contentBounds.current.height,
            width: contentBounds.current.width,
          }}
        >
          <span className="text-[clamp(0.425rem,25cqw,0.825rem)]">{t(selectedContent.name)}</span>
        </div>
      )}
    </>
  );
};

type BuildContentMetaOptions = {
  item: ContentPaletteItem;
  page: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
};

/**
 * Build the content metadata for a newly dropped content, merging the drop
 * geometry into the default values for the given content type.
 *
 * Geometry is handled per content type since it differs, e.g. lines use
 * start/end coordinates instead of a position and size.
 */
/**
 * The screen size of the drag preview for a content type.
 *
 * Image contents preview at their page relative default size so the preview
 * matches the box which gets created, the rest use a fixed screen size.
 */
const resolveDragBounds = (item: ContentPaletteItem | null, $page: Element) => {
  if (item !== null && CONTENT_TYPE_DATA_CONTENT_KIND[item.type] !== undefined) {
    const { width, height } = getBoundingClientRect($page);

    return {
      width: (width * CONTENT_IMAGE_DEFAULT_SIZE.width) / 100,
      height: (height * CONTENT_IMAGE_DEFAULT_SIZE.height) / 100,
    };
  }

  return {
    width: DEFAULT_WIDTH_PX,
    height: DEFAULT_HEIGHT_PX,
  };
};

const buildContentMeta = ({
  item,
  page,
  positionX,
  positionY,
  width,
  height,
}: BuildContentMetaOptions): TEnvelopeContentMetaOutput => {
  const { type } = item;

  return match(type)
    .with(EnvelopeContentType.LINE, () => ({
      ...structuredClone(CONTENT_LINE_META_DEFAULT_VALUES),
      page,
      // Lines are placed horizontally across the drop area, centered vertically.
      startXPosition: positionX,
      endXPosition: positionX + width,
      startYPosition: positionY + height / 2,
      endYPosition: positionY + height / 2,
    }))
    .with(EnvelopeContentType.IMAGE, () => ({
      ...structuredClone(CONTENT_META_DEFAULT_VALUES[type]),
      page,
      // Image contents use a page relative default size, so whether the
      // author has resized the box can be told when an image is attached.
      // Centered on the drop point like the other contents.
      positionX: positionX + width / 2 - CONTENT_IMAGE_DEFAULT_SIZE.width / 2,
      positionY: positionY + height / 2 - CONTENT_IMAGE_DEFAULT_SIZE.height / 2,
      ...CONTENT_IMAGE_DEFAULT_SIZE,
    }))
    .with(EnvelopeContentType.SHAPE, () => ({
      ...structuredClone(CONTENT_SHAPE_META_DEFAULT_VALUES[item.shape ?? ContentShapeType.RECTANGLE]),
      page,
      positionX,
      positionY,
      width,
      height,
    }))
    .with(EnvelopeContentType.HIGHLIGHT, EnvelopeContentType.TEXT, () => ({
      ...structuredClone(CONTENT_META_DEFAULT_VALUES[type]),
      page,
      positionX,
      positionY,
      width,
      height,
    }))
    .exhaustive();
};
