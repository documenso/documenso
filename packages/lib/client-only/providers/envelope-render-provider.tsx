import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import React from 'react';

import { DocumentDataType, type Field, type Recipient } from '@prisma/client';
import pMap from 'p-map';

import { PDF_IMAGE_RENDER_SCALE } from '@documenso/lib/constants/pdf-viewer';
import { getEnvelopeItemPdfUrl } from '@documenso/lib/utils/envelope-download';
import type { TGetEnvelopeItemsMetaResponse } from '@documenso/remix/server/api/files/files.types';
import type { TRecipientColor } from '@documenso/ui/lib/recipient-colors';
import { AVAILABLE_RECIPIENT_COLORS } from '@documenso/ui/lib/recipient-colors';

import type { DocumentDataVersion } from '../../types/document-data';
import type { TEnvelope } from '../../types/envelope';
import type { FieldRenderMode } from '../../universal/field-renderer/render-field';
import { getEnvelopeItemMetaUrl, getEnvelopeItemPageImageUrl } from '../../utils/envelope-images';

/**
 * Number of pages to load eagerly on initial render.
 * Pages beyond this threshold will be loaded lazily when they enter the viewport.
 */
export const EAGER_LOAD_PAGE_COUNT = 5;

// Todo: Embeds
export const PRESIGNED_ENVELOPE_ITEM_ID_PREFIX = 'PRESIGNED_';

export type PageRenderData = BasePageRenderData & {
  scale: number;
};

export type BasePageRenderData = {
  envelopeItemId: string;
  documentDataId: string;
  pageIndex: number;
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  imageUrl: string;
};

export type ImageLoadingState = 'loading' | 'loaded' | 'error';

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
  data?: Uint8Array | null;
};

type EnvelopeRenderProviderValue = {
  version: DocumentDataVersion;
  envelopeItems: EnvelopeRenderItem[];
  envelopeItemsMeta: Record<string, BasePageRenderData[]>;
  envelopeItemsMetaLoadingState: ImageLoadingState;
  envelopeStatus: TEnvelope['status'];
  envelopeType: TEnvelope['type'];
  currentEnvelopeItem: EnvelopeRenderItem | null;
  setCurrentEnvelopeItem: (envelopeItemId: string) => void;
  fields: Field[];
  recipients: Pick<Recipient, 'id' | 'name' | 'email' | 'signingStatus'>[];
  getRecipientColorKey: (recipientId: number) => TRecipientColor;

  renderError: boolean;
  setRenderError: (renderError: boolean) => void;
  overrideSettings?: EnvelopeRenderOverrideSettings;
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
   */
  envelopeItems: EnvelopeRenderItem[];

  /**
   * Optional fields which are passed down to renderers for custom rendering needs.
   *
   * Only pass if the CustomRenderer you are passing in wants fields.
   */
  fields?: Field[];

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
  token,
  presignToken,
  recipients = [],
  version,
  overrideSettings,
}: EnvelopeRenderProviderProps) => {
  // Indexed by envelope item ID.
  const [envelopeItemsMeta, setEnvelopeItemsMeta] = useState<Record<string, BasePageRenderData[]>>(
    {},
  );

  const [envelopeItemsMetaLoadingState, setEnvelopeItemsMetaLoadingState] =
    useState<ImageLoadingState>('loading');

  const [renderError, setRenderError] = useState<boolean>(false);

  // Track the timestamp of the most recent fetch to prevent race conditions
  const fetchStartedAtRef = useRef<number>(0);

  const envelopeItems = useMemo(
    () => envelopeItemsFromProps.sort((a, b) => a.order - b.order),
    [envelopeItemsFromProps],
  );

  const [currentItem, setCurrentItem] = useState<EnvelopeRenderItem | null>(
    envelopeItems[0] ?? null,
  );

  /**
   * Fetch metadata and preload initial images when the envelope or token changes.
   */
  useEffect(() => {
    void fetchEnvelopeRenderData();
  }, [envelope.id, envelopeItems, token, version]);

  const fetchEnvelopeRenderData = useCallback(async () => {
    if (envelopeItems.length === 0) {
      setEnvelopeItemsMetaLoadingState('loaded');
      return;
    }

    // Handle "create" embedding mode since all the files are local in that scenario.
    if (!envelope.id) {
      await handleLocalFileFetch();

      return;
    }

    // Record when this fetch started to detect stale responses
    const fetchStartedAt = Date.now();
    fetchStartedAtRef.current = fetchStartedAt;

    setEnvelopeItemsMetaLoadingState('loading');

    try {
      // Fetch metadata for all envelope items
      const metaUrl = getEnvelopeItemMetaUrl({
        envelopeId: envelope.id,
        token,
        presignToken,
      });

      const response = await fetch(metaUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch envelope meta: ${response.status}`);
      }

      const data: TGetEnvelopeItemsMetaResponse = await response.json();

      // Check again after parsing JSON in case a newer fetch started
      if (fetchStartedAtRef.current !== fetchStartedAt) {
        return;
      }

      // Build a map of envelope items by ID
      const metaMap: Record<string, BasePageRenderData[]> = {};

      const s3EnvelopeItems = data.envelopeItems.filter(
        (item) => item.documentDataType === DocumentDataType.S3_PATH,
      );

      const localPdfs: { envelopeItemId: string; documentDataId: string; data: Uint8Array }[] = [];

      // Handle local envelope items from embedding flows.
      for (const item of envelopeItems) {
        if (item.data) {
          localPdfs.push({
            envelopeItemId: item.id,
            documentDataId: item.id,
            data: new Uint8Array(item.data as Uint8Array),
          });
        }
      }

      const bytes64EnvelopeItems = data.envelopeItems.filter(
        (item) => item.documentDataType !== DocumentDataType.S3_PATH,
      );

      // Handle byte64 envelope items from the database.
      const pdfs = await pMap(
        bytes64EnvelopeItems,
        async (item) => {
          const envelopeItemPdfUrl = getEnvelopeItemPdfUrl({
            type: 'view',
            envelopeItem: {
              id: item.envelopeItemId,
              envelopeId: envelope.id,
            },
            token,
            presignToken,
          });

          const response = await fetch(envelopeItemPdfUrl);

          if (!response.ok) {
            throw new Error(`Failed to fetch envelope item PDF: ${response.status}`);
          }

          const pdfBytes = await response.arrayBuffer();

          return {
            envelopeItemId: item.envelopeItemId,
            documentDataId: item.documentDataId,
            data: new Uint8Array(pdfBytes),
          };
        },
        { concurrency: 5 },
      );

      localPdfs.push(...pdfs);

      for (const item of s3EnvelopeItems) {
        metaMap[item.envelopeItemId] = item.pages.map((page, pageIndex) => {
          const imageUrl = getEnvelopeItemPageImageUrl({
            envelopeId: envelope.id,
            envelopeItemId: item.envelopeItemId,
            documentDataId: item.documentDataId,
            pageIndex,
            token,
            presignToken,
            version,
          });

          return {
            envelopeItemId: item.envelopeItemId,
            documentDataId: item.documentDataId,
            pageIndex,
            pageNumber: pageIndex + 1,
            pageWidth: page.originalWidth,
            pageHeight: page.originalHeight,
            imageUrl,
          };
        });
      }

      if (localPdfs.length > 0) {
        // Dynamically import "pdfToImagesClientSide" function to prevent bundling.
        const { pdfToImagesClientSide } = await import(
          '@documenso/lib/server-only/ai/pdf-to-images.client'
        );

        await pMap(
          localPdfs,
          async (item) => {
            const pdfImages = await pdfToImagesClientSide(item.data, {
              scale: PDF_IMAGE_RENDER_SCALE,
            });

            metaMap[item.envelopeItemId] = pdfImages.map((image) => ({
              envelopeItemId: item.envelopeItemId,
              documentDataId: item.documentDataId,
              pageIndex: image.pageIndex,
              pageNumber: image.pageIndex + 1,
              pageWidth: image.width,
              pageHeight: image.height,
              imageUrl: image.image,
            }));
          },
          { concurrency: 10 },
        );
      }

      // Append all local embedding files.
      const localFiles = envelopeItems.filter(
        (item) => item.id.startsWith(PRESIGNED_ENVELOPE_ITEM_ID_PREFIX) && item.data,
      );

      for (const item of localFiles) {
        if (!item.data) {
          throw new Error('Not possible');
        }

        // Handle local files
      }

      setEnvelopeItemsMeta(metaMap);

      setEnvelopeItemsMetaLoadingState('loaded');
    } catch (error) {
      // Only set error state if this is still the most recent fetch
      if (fetchStartedAtRef.current === fetchStartedAt) {
        console.error('Failed to load envelope data:', error);
        setEnvelopeItemsMetaLoadingState('error');
      }
    }
  }, [envelope.id, envelopeItems, token, version]);

  const handleLocalFileFetch = async () => {
    setEnvelopeItemsMetaLoadingState('loading');

    try {
      // Build a map of envelope items by ID
      const metaMap: Record<string, BasePageRenderData[]> = {};

      // Dynamically import "pdfToImagesClientSide" function to prevent bundling.
      const { pdfToImagesClientSide } = await import(
        '@documenso/lib/server-only/ai/pdf-to-images.client'
      );

      for (const item of envelopeItems) {
        if (item.data) {
          // Clone the buffer so PDF.js can transfer it to its worker without detaching the one in state
          const pdfBytes = new Uint8Array(structuredClone(item.data));

          const pdfImages = await pdfToImagesClientSide(pdfBytes, {
            scale: PDF_IMAGE_RENDER_SCALE,
          });

          metaMap[item.id] = pdfImages.map((image) => ({
            envelopeItemId: item.id,
            documentDataId: item.id,
            pageIndex: image.pageIndex,
            pageNumber: image.pageIndex + 1,
            pageWidth: image.width,
            pageHeight: image.height,
            imageUrl: image.image,
          }));
        }
      }

      setEnvelopeItemsMeta(metaMap);
      setEnvelopeItemsMetaLoadingState('loaded');
    } catch (error) {
      console.error('Failed to load envelope data:', error);
      setEnvelopeItemsMetaLoadingState('error');
    }
  };

  const setCurrentEnvelopeItem = (envelopeItemId: string) => {
    const foundItem = envelopeItems.find((item) => item.id === envelopeItemId);

    setCurrentItem(foundItem ?? null);
  };

  // Set the selected item to the first item if none is set.
  useEffect(() => {
    if (currentItem && !envelopeItems.some((item) => item.id === currentItem.id)) {
      setCurrentItem(null);
    }

    if (!currentItem && envelopeItems.length > 0) {
      setCurrentEnvelopeItem(envelopeItems[0].id);
    }
  }, [currentItem, envelopeItems]);

  const recipientIds = useMemo(
    () => recipients.map((recipient) => recipient.id).sort(),
    [recipients],
  );

  const getRecipientColorKey = useCallback(
    (recipientId: number) => {
      const recipientIndex = recipientIds.findIndex((id) => id === recipientId);

      return AVAILABLE_RECIPIENT_COLORS[
        Math.max(recipientIndex, 0) % AVAILABLE_RECIPIENT_COLORS.length
      ];
    },
    [recipientIds],
  );

  return (
    <EnvelopeRenderContext.Provider
      value={{
        version,
        envelopeItemsMeta,
        envelopeItemsMetaLoadingState,
        envelopeItems,
        envelopeStatus: envelope.status,
        envelopeType: envelope.type,
        currentEnvelopeItem: currentItem,
        setCurrentEnvelopeItem,
        fields: fields ?? [],
        recipients,
        getRecipientColorKey,
        renderError,
        setRenderError,
        overrideSettings,
      }}
    >
      {children}
    </EnvelopeRenderContext.Provider>
  );
};
