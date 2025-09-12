import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import React from 'react';

import type { DocumentData } from '@prisma/client';

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
}: EnvelopeRenderProviderProps) => {
  // Indexed by documentDataId.
  const [files, setFiles] = useState<Record<string, FileData>>({});

  const [currentItem, setItem] = useState<EnvelopeRenderItem | null>(null);

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

  return (
    <EnvelopeRenderContext.Provider
      value={{
        getPdfBuffer,
        envelopeItems,
        currentEnvelopeItem: currentItem,
        setCurrentEnvelopeItem,
        fields: fields ?? [],
      }}
    >
      {children}
    </EnvelopeRenderContext.Provider>
  );
};
