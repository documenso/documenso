import type { DocumentDataVersion } from '@documenso/lib/types/document';
import { getDocumentDataUrl } from '@documenso/lib/utils/envelope-download';
import type { TRecipientColor } from '@documenso/ui/lib/recipient-colors';
import { getRecipientColor } from '@documenso/ui/lib/recipient-colors';
import type { EnvelopeContent, Field, Recipient } from '@prisma/client';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { clamp } from 'remeda';

import type { TEnvelope } from '../../types/envelope';
import { areContentsImprinted } from '../../utils/envelope';

export type EnvelopeRenderContent = Pick<EnvelopeContent, 'id' | 'envelopeItemId' | 'contentMeta' | 'dataContentId'> & {
  data?: Blob;
};

import type { EnvelopePageItemsVisibility } from '../../types/envelope-page-items-visibility';
import type { FieldRenderMode } from '../../universal/field-renderer/field-renderer';
import { type ContentImages, useContentImages } from '../hooks/use-content-images';

export const ENVELOPE_VIEWER_MIN_ZOOM = 0.5;
export const ENVELOPE_VIEWER_MAX_ZOOM = 2;
export const ENVELOPE_VIEWER_ZOOM_STEP = 0.25;

export type EnvelopeViewerControls = {
  zoom: number;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;

  fieldsVisibility: EnvelopePageItemsVisibility;
  setFieldsVisibility: (visibility: EnvelopePageItemsVisibility) => void;

  contentsVisibility: EnvelopePageItemsVisibility;
  setContentsVisibility: (visibility: EnvelopePageItemsVisibility) => void;
};

/**
 * The signature data for an inserted signature field.
 *
 * Loaded separately from the envelope to avoid bloating the envelope.get response
 * with potentially large base64 image payloads.
 */
export type EnvelopeRenderFieldSignature = {
  fieldId: number;
  signatureImageAsBase64: string | null;
  typedSignature: string | null;
};

export type PageRenderData = {
  scale: number;
  pageIndex: number;
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  imageLoadingState: ImageLoadingState;

  /**
   * The page holds back its bitmap until the renderer reports ready, so a
   * renderer which loads its own assets (e.g. content images) is never shown
   * half drawn.
   */
  onReadyChange?: (isReady: boolean) => void;
};

export type ImageLoadingState = 'loading' | 'loaded' | 'error';

export type PageSize = {
  width: number;
  height: number;
};

/**
 * Sizes are unscaled.
 */
export type PageSizeRegistry = {
  register: (envelopeItemId: string, pageNumber: number, size: PageSize) => void;
  get: (envelopeItemId: string, pageNumber: number) => PageSize | null;
};

type EnvelopeRenderOverrideSettings = {
  mode?: FieldRenderMode;
  showRecipientTooltip?: boolean;
  showRecipientSigningStatus?: boolean;
};

type EnvelopeRenderItem = {
  id: string;
  title: string;
  order: number;
  envelopeId: string;

  /**
   * The PDF data to render.
   *
   * If it's a string we assume it's a URL to the PDF file.
   */
  data: Uint8Array | string;
};

type EnvelopeRenderProviderValue = {
  version: DocumentDataVersion;
  envelopeItems: EnvelopeRenderItem[];
  envelopeStatus: TEnvelope['status'];
  envelopeType: TEnvelope['type'];
  currentEnvelopeItem: EnvelopeRenderItem | null;
  setCurrentEnvelopeItem: (envelopeItemId: string) => void;
  fields: Field[];
  contents: EnvelopeRenderContent[];

  contentImages: ContentImages;

  pageSizes: PageSizeRegistry;

  signatures: EnvelopeRenderFieldSignature[];
  recipients: Pick<Recipient, 'id' | 'name' | 'email' | 'signingStatus'>[];
  getRecipientColorKey: (recipientId: number) => TRecipientColor;

  renderError: boolean;
  setRenderError: (renderError: boolean) => void;
  overrideSettings?: EnvelopeRenderOverrideSettings;

  viewerControls: EnvelopeViewerControls;
};

interface EnvelopeRenderProviderProps {
  children: React.ReactNode;

  /**
   * The envelope item version to render.
   */
  version: DocumentDataVersion;

  envelope: Pick<TEnvelope, 'id' | 'status' | 'type'>;

  /**
   * The envelope items to render.
   *
   * If data is optional then we build the URL based of the IDs.
   */
  envelopeItems: {
    id: string;
    title: string;
    order: number;
    envelopeId: string;
    documentDataId: string;
    data?: Uint8Array | string;
  }[];

  /**
   * Optional fields which are passed down to renderers for custom rendering needs.
   *
   * Only pass if the CustomRenderer you are passing in wants fields.
   */
  fields?: Field[];

  contents?: EnvelopeRenderContent[];

  /**
   * Optional inserted signature data for signature fields.
   *
   * Fetched separately from the envelope to keep the envelope response lean.
   * If a signature field has no entry here, the renderer will fall back to
   * showing the field type placeholder.
   */
  signatures?: EnvelopeRenderFieldSignature[];

  /**
   * Optional recipient used to determine the color of the fields and hover
   * previews.
   *
   * Only required for generic page renderers.
   */
  recipients?: Pick<Recipient, 'id' | 'name' | 'email' | 'signingStatus'>[];

  /**
   * The token to access the envelope.
   *
   * If not provided, it will be assumed that the current user can access the document.
   */
  token: string | undefined;

  /**
   * The presign token to access the envelope.
   *
   * If not provided, it will be assumed that the current user can access the document.
   */
  presignToken?: string | undefined;

  /**
   * Custom override settings for generic page renderers.
   */
  overrideSettings?: EnvelopeRenderOverrideSettings;
}

const EnvelopeRenderContext = createContext<EnvelopeRenderProviderValue | null>(null);

export const useCurrentEnvelopeRender = () => {
  const context = useContext(EnvelopeRenderContext);

  if (!context) {
    throw new Error('useCurrentEnvelopeRender must be used within a EnvelopeRenderProvider');
  }

  return context;
};

/**
 * Manages fetching the data required to render an envelope and it's items.
 */
export const EnvelopeRenderProvider = ({
  children,
  envelope,
  envelopeItems: envelopeItemsFromProps,
  fields,
  contents,
  signatures,
  token,
  presignToken,
  recipients = [],
  version,
  overrideSettings,
}: EnvelopeRenderProviderProps) => {
  const [renderError, setRenderError] = useState<boolean>(false);

  const [zoom, setZoomInternal] = useState<number>(1);
  const [fieldsVisibility, setFieldsVisibility] = useState<EnvelopePageItemsVisibility>('visible');
  const [contentsVisibility, setContentsVisibility] = useState<EnvelopePageItemsVisibility>('visible');

  const setZoom = useCallback((value: number) => {
    setZoomInternal(clamp(value, { min: ENVELOPE_VIEWER_MIN_ZOOM, max: ENVELOPE_VIEWER_MAX_ZOOM }));
  }, []);

  const zoomIn = useCallback(() => {
    setZoomInternal((prev) => Math.min(ENVELOPE_VIEWER_MAX_ZOOM, prev + ENVELOPE_VIEWER_ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomInternal((prev) => Math.max(ENVELOPE_VIEWER_MIN_ZOOM, prev - ENVELOPE_VIEWER_ZOOM_STEP));
  }, []);

  const viewerControls = useMemo(
    (): EnvelopeViewerControls => ({
      zoom,
      setZoom,
      zoomIn,
      zoomOut,
      fieldsVisibility,
      setFieldsVisibility,
      contentsVisibility,
      setContentsVisibility,
    }),
    [zoom, setZoom, zoomIn, zoomOut, fieldsVisibility, contentsVisibility],
  );

  const envelopeItems = useMemo(
    () =>
      [...envelopeItemsFromProps]
        .sort((a, b) => a.order - b.order)
        .map((item) => {
          const pdfUrl = getDocumentDataUrl({
            envelopeId: envelope.id,
            envelopeItemId: item.id,
            documentDataId: item.documentDataId,
            version,
            token,
            presignToken,
          });

          const data = item.data || pdfUrl;

          return {
            ...item,
            data,
          };
        }),
    [envelopeItemsFromProps, envelope.id, token, version, presignToken],
  );

  const [currentItemId, setCurrentItemId] = useState<string | null>(envelopeItems[0]?.id ?? null);

  const currentItem = useMemo((): EnvelopeRenderItem | null => {
    return envelopeItems.find((item) => item.id === currentItemId) ?? null;
  }, [currentItemId, envelopeItems]);

  const setCurrentEnvelopeItem = (envelopeItemId: string) => {
    const foundItem = envelopeItems.find((item) => item.id === envelopeItemId);

    setCurrentItemId(foundItem?.id ?? null);
  };

  // Set the selected item to the first item if none is set.
  useEffect(() => {
    if (currentItem && !envelopeItems.some((item) => item.id === currentItem.id)) {
      setCurrentItemId(null);
    }

    if (!currentItem && envelopeItems.length > 0) {
      setCurrentEnvelopeItem(envelopeItems[0].id);
    }
  }, [currentItem, envelopeItems]);

  const isContentsImprinted = version === 'current' && areContentsImprinted(envelope.status);

  const contentImages = useContentImages({
    envelopeId: envelope.id,
    envelopeItemId: currentItem?.id ?? null,
    contents: isContentsImprinted ? [] : (contents ?? []),
    token,
    presignToken,
  });

  // Sizes do not drive rendering, so a ref avoids re-rendering the tree as
  // pages register themselves.
  const pageSizesRef = useRef(new Map<string, PageSize>());

  const pageSizes = useMemo(
    (): PageSizeRegistry => ({
      register: (envelopeItemId, pageNumber, size) => {
        pageSizesRef.current.set(`${envelopeItemId}:${pageNumber}`, size);
      },
      get: (envelopeItemId, pageNumber) => {
        return pageSizesRef.current.get(`${envelopeItemId}:${pageNumber}`) ?? null;
      },
    }),
    [],
  );

  const recipientIds = useMemo(() => recipients.map((recipient) => recipient.id).sort(), [recipients]);

  const getRecipientColorKey = useCallback(
    (recipientId: number) => getRecipientColor(recipientIds.findIndex((id) => id === recipientId)),
    [recipientIds],
  );

  return (
    <EnvelopeRenderContext.Provider
      value={{
        version,
        envelopeItems,
        envelopeStatus: envelope.status,
        envelopeType: envelope.type,
        currentEnvelopeItem: currentItem,
        setCurrentEnvelopeItem,
        fields: fields ?? [],
        contents: contents ?? [],
        contentImages,
        pageSizes,
        signatures: signatures ?? [],
        recipients,
        getRecipientColorKey,
        renderError,
        setRenderError,
        overrideSettings,
        viewerControls,
      }}
    >
      {children}
    </EnvelopeRenderContext.Provider>
  );
};
