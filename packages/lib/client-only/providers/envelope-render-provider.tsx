import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import React from 'react';

import type { DocumentData } from '@prisma/client';

import type { TRecipientColor } from '@documenso/ui/lib/recipient-colors';
import { AVAILABLE_RECIPIENT_COLORS } from '@documenso/ui/lib/recipient-colors';

import type { TEnvelope } from '../../types/envelope';
import { getFile } from '../../universal/upload/get-file';

type FileData =
  | {
      status: 'loading' | 'error';
    }
  | {
      file: Uint8Array;
      status: 'loaded';
    };

type EnvelopeRenderItem = TEnvelope['envelopeItems'][number];

type EnvelopeRenderProviderValue = {
  getPdfBuffer: (documentDataId: string) => FileData | null;
  envelopeItems: EnvelopeRenderItem[];
  currentEnvelopeItem: EnvelopeRenderItem | null;
  setCurrentEnvelopeItem: (envelopeItemId: string) => void;
  fields: TEnvelope['fields'];
  getRecipientColorKey: (recipientId: number) => TRecipientColor;

  renderError: boolean;
  setRenderError: (renderError: boolean) => void;
};

interface EnvelopeRenderProviderProps {
  children: React.ReactNode;
  envelope: Pick<TEnvelope, 'envelopeItems'>;

  /**
   * Optional fields which are passed down to renderers for custom rendering needs.
   *
   * Only pass if the CustomRenderer you are passing in wants fields.
   */
  fields?: TEnvelope['fields'];

  /**
   * Optional recipient IDs used to determine the color of the fields.
   *
   * Only required for generic page renderers.
   */
  recipientIds?: number[];
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
 * Manages fetching and storing PDF files to render on the client.
 */
export const EnvelopeRenderProvider = ({
  children,
  envelope,
  fields,
  recipientIds = [],
}: EnvelopeRenderProviderProps) => {
  // Indexed by documentDataId.
  const [files, setFiles] = useState<Record<string, FileData>>({});

  const [currentItem, setItem] = useState<EnvelopeRenderItem | null>(null);

  const [renderError, setRenderError] = useState<boolean>(false);

  const envelopeItems = useMemo(
    () => envelope.envelopeItems.sort((a, b) => a.order - b.order),
    [envelope.envelopeItems],
  );

  const loadEnvelopeItemPdfFile = async (documentData: DocumentData) => {
    if (files[documentData.id]?.status === 'loading') {
      return;
    }

    if (!files[documentData.id]) {
      setFiles((prev) => ({
        ...prev,
        [documentData.id]: {
          status: 'loading',
        },
      }));
    }

    try {
      const file = await getFile(documentData);

      setFiles((prev) => ({
        ...prev,
        [documentData.id]: {
          file,
          status: 'loaded',
        },
      }));
    } catch (error) {
      console.error(error);

      setFiles((prev) => ({
        ...prev,
        [documentData.id]: {
          status: 'error',
        },
      }));
    }
  };

  const getPdfBuffer = useCallback(
    (documentDataId: string) => {
      return files[documentDataId] || null;
    },
    [files],
  );

  const setCurrentEnvelopeItem = (envelopeItemId: string) => {
    const foundItem = envelope.envelopeItems.find((item) => item.id === envelopeItemId);

    setItem(foundItem ?? null);
  };

  // Set the selected item to the first item if none is set.
  useEffect(() => {
    if (!currentItem && envelopeItems.length > 0) {
      setCurrentEnvelopeItem(envelopeItems[0].id);
    }
  }, [currentItem, envelopeItems]);

  // Look for any missing pdf files and load them.
  useEffect(() => {
    const missingFiles = envelope.envelopeItems.filter((item) => !files[item.documentDataId]);

    for (const item of missingFiles) {
      void loadEnvelopeItemPdfFile(item.documentData);
    }
  }, [envelope.envelopeItems]);

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
        getPdfBuffer,
        envelopeItems,
        currentEnvelopeItem: currentItem,
        setCurrentEnvelopeItem,
        fields: fields ?? [],
        getRecipientColorKey,
        renderError,
        setRenderError,
      }}
    >
      {children}
    </EnvelopeRenderContext.Provider>
  );
};
