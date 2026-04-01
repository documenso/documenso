import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import React from 'react';

import { type Field, type Recipient } from '@prisma/client';

import type { DocumentDataVersion } from '@documenso/lib/types/document';
import { getDocumentDataUrl } from '@documenso/lib/utils/envelope-download';
import type { TRecipientColor } from '@documenso/ui/lib/recipient-colors';
import { getRecipientColor } from '@documenso/ui/lib/recipient-colors';

import type { TEnvelope } from '../../types/envelope';
import type { FieldRenderMode } from '../../universal/field-renderer/render-field';

export type PageRenderData = {
  scale: number;
  pageIndex: number;
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  imageLoadingState: ImageLoadingState;
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
  const [renderError, setRenderError] = useState<boolean>(false);

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

  const recipientIds = useMemo(
    () => recipients.map((recipient) => recipient.id).sort(),
    [recipients],
  );

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
