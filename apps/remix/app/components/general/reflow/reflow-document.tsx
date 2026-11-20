/**
 * Easy-read view of the document being signed, for phones. The PDF's text is rebuilt as paragraphs that wrap
 * to the screen (utils/reflow/build-reflow.ts), with the signer's fields inline as buttons. Tapping one runs
 * the same steps as tapping the field on the original page, so the PDF is still what gets signed and sealed.
 */
import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import { DIRECT_TEMPLATE_RECIPIENT_EMAIL } from '@documenso/lib/constants/direct-templates';
import { isBase64Image } from '@documenso/lib/constants/signatures';
import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { ZFullFieldSchema } from '@documenso/lib/types/field';
import { isFieldUnsignedAndRequired } from '@documenso/lib/utils/advanced-fields-helpers';
import { extractFullInitials } from '@documenso/lib/utils/recipient-formatter';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { cn } from '@documenso/ui/lib/utils';
import { useToast } from '@documenso/ui/primitives/use-toast';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { type Field, FieldType, RecipientRole, type Signature } from '@prisma/client';
import { Loader2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { match } from 'ts-pattern';

import { useEmbedSigningContext } from '~/components/embed/embed-signing-context';
import { handleDropdownFieldClick } from '~/utils/field-signing/dropdown-field';
import { handleEmailFieldClick } from '~/utils/field-signing/email-field';
import { handleInitialsFieldClick } from '~/utils/field-signing/initial-field';
import { handleNameFieldClick } from '~/utils/field-signing/name-field';
import { handleNumberFieldClick } from '~/utils/field-signing/number-field';
import { handleSignatureFieldClick } from '~/utils/field-signing/signature-field';
import { handleTextFieldClick } from '~/utils/field-signing/text-field';
import { buildReflowBlocks, type ReflowBlock, type ReflowPage } from '~/utils/reflow/build-reflow';

import { useRequiredDocumentSigningAuthContext } from '../document-signing/document-signing-auth-provider';
import { useRequiredEnvelopeSigningContext } from '../document-signing/envelope-signing-provider';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

type SignerField = Field & { signature?: Signature | null };

// Below this many characters the document is a scan or an image: nothing to reflow.
const MIN_TEXT_CHARACTERS = 80;

const FIELD_TYPE_LABEL: Partial<Record<FieldType, MessageDescriptor>> = {
  [FieldType.SIGNATURE]: msg`Sign here`,
  [FieldType.FREE_SIGNATURE]: msg`Sign here`,
  [FieldType.INITIALS]: msg`Initials`,
  [FieldType.NAME]: msg`Name`,
  [FieldType.EMAIL]: msg`Email`,
  [FieldType.DATE]: msg`Date`,
  [FieldType.TEXT]: msg`Text`,
  [FieldType.NUMBER]: msg`Number`,
  [FieldType.DROPDOWN]: msg`Select`,
  [FieldType.CHECKBOX]: msg`Checkbox`,
  [FieldType.RADIO]: msg`Choose`,
};

const loadPages = async (data: Uint8Array | string): Promise<ReflowPage[]> => {
  let bytes: Uint8Array;

  if (typeof data === 'string') {
    const response = await fetch(data);

    if (!response.ok) {
      throw new Error(`Failed to fetch PDF data: ${response.status}`);
    }

    bytes = new Uint8Array(await response.arrayBuffer());
  } else {
    bytes = new Uint8Array(data);
  }

  const pdf = await pdfjsLib.getDocument({ data: bytes, cMapUrl: '/static/cmaps/' }).promise;

  try {
    const pages: ReflowPage[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();

      // Font names (where bold and italic come from) are only available once the page's fonts are loaded.
      await page.getOperatorList();

      const fontName = (id: string) => {
        try {
          return page.commonObjs.has(id) ? (page.commonObjs.get(id)?.name ?? id) : id;
        } catch {
          return id;
        }
      };

      pages.push({
        pageNumber,
        width: viewport.width,
        height: viewport.height,
        items: content.items.flatMap((item) => {
          if (!('str' in item)) {
            return [];
          }

          // Origin at the top left of the page, as field positions use.
          const [, , , , x, baseline] = pdfjsLib.Util.transform(viewport.transform, item.transform);

          return [
            {
              str: item.str,
              x,
              baseline,
              width: item.width,
              size: Math.hypot(item.transform[2], item.transform[3]),
              font: fontName(item.fontName),
            },
          ];
        }),
      });
    }

    return pages;
  } finally {
    await pdf.destroy();
  }
};

export type ReflowDocumentProps = {
  /** Called for a field this view can't fill (checkbox, radio) or a document without text. */
  onShowOriginal: () => void;
};

export default function ReflowDocument({ onShowOriginal }: ReflowDocumentProps) {
  const { t, i18n } = useLingui();
  const { envelopeItems, currentEnvelopeItem, signatures } = useCurrentEnvelopeRender();
  const { sessionData } = useOptionalSession();
  const { executeActionAuthProcedure } = useRequiredDocumentSigningAuthContext();
  const { toast } = useToast();
  const { onFieldSigned, onFieldUnsigned, onSignatureChanged } = useEmbedSigningContext() || {};

  const {
    envelopeData,
    recipient,
    recipientFields,
    recipientFieldsRemaining,
    showPendingFieldTooltip,
    signField: signFieldInternal,
    email,
    setEmail,
    fullName,
    setFullName,
    signature,
    setSignature,
    selectedAssistantRecipientFields,
    selectedAssistantRecipient,
    isDirectTemplate,
  } = useRequiredEnvelopeSigningContext();

  const { envelope } = envelopeData;

  // Every document of the envelope is read up front, so switching documents (or "Next field") is instant.
  const [pagesByItem, setPagesByItem] = useState<Record<string, ReflowPage[] | 'error'>>({});
  const [loadingFieldIds, setLoadingFieldIds] = useState<number[]>([]);

  const currentItemIdRef = useRef(currentEnvelopeItem?.id);
  currentItemIdRef.current = currentEnvelopeItem?.id;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const ordered = [...envelopeItems].sort(
        (a, b) => Number(b.id === currentItemIdRef.current) - Number(a.id === currentItemIdRef.current),
      );

      for (const item of ordered) {
        if (cancelled) {
          return;
        }

        const pages = await loadPages(item.data).catch((err) => {
          console.error('[reflow] could not read', item.title, err);
          return 'error' as const;
        });

        if (!cancelled) {
          setPagesByItem((prev) => ({ ...prev, [item.id]: pages }));
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [envelopeItems]);

  const fields = useMemo((): SignerField[] => {
    const all = recipient.role === RecipientRole.ASSISTANT ? selectedAssistantRecipientFields : recipientFields;

    return all.filter((field) => field.envelopeItemId === currentEnvelopeItem?.id);
  }, [recipient.role, recipientFields, selectedAssistantRecipientFields, currentEnvelopeItem?.id]);

  const pages = currentEnvelopeItem ? pagesByItem[currentEnvelopeItem.id] : undefined;

  const blocks = useMemo((): ReflowBlock[] | null => {
    if (!pages || pages === 'error') {
      return null;
    }

    const boxes = fields.flatMap((field) => {
      const page = pages.find((p) => p.pageNumber === field.page);

      if (!page) {
        return [];
      }

      return [
        {
          id: field.id,
          page: field.page,
          x: (Number(field.positionX) / 100) * page.width,
          y: (Number(field.positionY) / 100) * page.height,
          width: (Number(field.width) / 100) * page.width,
          height: (Number(field.height) / 100) * page.height,
        },
      ];
    });

    return buildReflowBlocks(pages, boxes);
  }, [pages, fields]);

  const textLength = useMemo(
    () =>
      pages && pages !== 'error'
        ? pages.reduce((sum, page) => sum + page.items.reduce((s, item) => s + item.str.trim().length, 0), 0)
        : 0,
    [pages],
  );

  const unreadable = pages === 'error' || (!!pages && textLength < MIN_TEXT_CHARACTERS);

  const fieldsById = useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields]);

  const signField = async (fieldId: number, payload: TSignEnvelopeFieldValue, authOptions?: TRecipientActionAuth) => {
    try {
      const { inserted } = await signFieldInternal(fieldId, payload, authOptions);

      if (inserted && onFieldSigned) {
        const value = payload.value ? JSON.stringify(payload.value) : undefined;

        onFieldSigned({ fieldId, value, isBase64: value ? isBase64Image(value) : undefined });
      }

      if (!inserted && onFieldUnsigned) {
        onFieldUnsigned({ fieldId });
      }
    } catch (err) {
      console.error(err);

      toast({
        title: t`Error`,
        description: t`An error occurred while signing the field.`,
        variant: 'destructive',
      });

      throw err;
    }
  };

  const withLoading = async (fieldId: number, action: () => Promise<void>) => {
    setLoadingFieldIds((prev) => [...prev, fieldId]);

    try {
      await action();
    } catch {
      // signField has already shown the error toast.
    } finally {
      setLoadingFieldIds((prev) => prev.filter((id) => id !== fieldId));
    }
  };

  // Mirrors EnvelopeSignerPageRenderer's field click, so both views sign a field the same way.
  const onFieldClick = (unparsedField: SignerField) => {
    if (unparsedField.fieldMeta && (unparsedField.fieldMeta as { readOnly?: boolean }).readOnly) {
      return;
    }

    if (loadingFieldIds.includes(unparsedField.id)) {
      return;
    }

    let localEmail: string | null = email;
    let localFullName: string | null = fullName;
    let placeholderEmail: string | null = null;

    if (recipient.role === RecipientRole.ASSISTANT) {
      localEmail = selectedAssistantRecipient?.email || null;
      localFullName = selectedAssistantRecipient?.name || null;
    }

    if (isDirectTemplate) {
      placeholderEmail = sessionData?.user?.email || email || recipient.email;

      if (!placeholderEmail || placeholderEmail === DIRECT_TEMPLATE_RECIPIENT_EMAIL) {
        placeholderEmail = null;
      }
    }

    const field = ZFullFieldSchema.parse(unparsedField);

    match(field)
      .with({ type: FieldType.TEXT }, (f) => {
        void handleTextFieldClick({ field: f, text: null }).then(
          async (payload) => payload && (await withLoading(f.id, async () => signField(f.id, payload))),
        );
      })
      .with({ type: FieldType.NUMBER }, (f) => {
        void handleNumberFieldClick({ field: f, number: null }).then(
          async (payload) => payload && (await withLoading(f.id, async () => signField(f.id, payload))),
        );
      })
      .with({ type: FieldType.EMAIL }, (f) => {
        void handleEmailFieldClick({ field: f, email: localEmail, placeholderEmail }).then(async (payload) => {
          if (payload) {
            await withLoading(f.id, async () => signField(f.id, payload));
          }

          if (payload?.value) {
            setEmail(payload.value);
          }
        });
      })
      .with({ type: FieldType.INITIALS }, (f) => {
        const initials = localFullName ? extractFullInitials(localFullName) : null;

        void handleInitialsFieldClick({ field: f, initials }).then(
          async (payload) => payload && (await withLoading(f.id, async () => signField(f.id, payload))),
        );
      })
      .with({ type: FieldType.NAME }, (f) => {
        void handleNameFieldClick({ field: f, name: localFullName }).then(async (payload) => {
          if (payload) {
            await withLoading(f.id, async () => signField(f.id, payload));
          }

          if (payload?.value) {
            setFullName(payload.value);
          }
        });
      })
      .with({ type: FieldType.DROPDOWN }, (f) => {
        void handleDropdownFieldClick({ field: f, text: null }).then(
          async (payload) => payload && (await withLoading(f.id, async () => signField(f.id, payload))),
        );
      })
      .with({ type: FieldType.DATE }, (f) => {
        void withLoading(f.id, async () => signField(f.id, { type: FieldType.DATE, value: !f.inserted }));
      })
      .with({ type: FieldType.SIGNATURE }, (f) => {
        void handleSignatureFieldClick({
          field: f,
          fullName,
          signature,
          typedSignatureEnabled: envelope.documentMeta.typedSignatureEnabled,
          uploadSignatureEnabled: envelope.documentMeta.uploadSignatureEnabled,
          drawSignatureEnabled: envelope.documentMeta.drawSignatureEnabled,
        }).then(async (payload) => {
          if (!payload) {
            return;
          }

          if (payload.value) {
            await withLoading(f.id, async () => {
              await executeActionAuthProcedure({
                onReauthFormSubmit: async (authOptions) => {
                  await signField(f.id, payload, authOptions);
                },
                actionTarget: f.type,
              });
            });

            setSignature(payload.value);
            onSignatureChanged?.(payload.value);
          } else {
            await withLoading(f.id, async () => signField(f.id, payload));
          }
        });
      })
      // Checkbox and radio options are laid out on the page itself, so they are filled in on the original page.
      .otherwise(() => onShowOriginal());
  };

  if (!currentEnvelopeItem) {
    return null;
  }

  if (unreadable) {
    return (
      <div className="w-full max-w-[680px] rounded-lg border bg-white px-5 py-8 text-center text-neutral-700">
        <p className="mb-4">
          <Trans>This document can only be shown as the original page.</Trans>
        </p>
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
          onClick={onShowOriginal}
        >
          <Trans>Show the original page</Trans>
        </button>
      </div>
    );
  }

  if (!blocks) {
    return (
      <div className="flex w-full max-w-[680px] items-center justify-center rounded-lg border bg-white py-24 text-neutral-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <Trans>Loading document…</Trans>
      </div>
    );
  }

  const nextFieldId =
    showPendingFieldTooltip && recipientFieldsRemaining[0]?.envelopeItemId === currentEnvelopeItem.id
      ? recipientFieldsRemaining[0].id
      : null;

  const signatureOf = (field: SignerField) => {
    const fromRender = signatures.find((s) => s.fieldId === field.id);

    return {
      image: field.signature?.signatureImageAsBase64 ?? fromRender?.signatureImageAsBase64 ?? null,
      typed: field.signature?.typedSignature ?? fromRender?.typedSignature ?? null,
    };
  };

  const renderField = (field: SignerField) => {
    const meta = (field.fieldMeta ?? {}) as {
      label?: string;
      placeholder?: string;
      readOnly?: boolean;
      required?: boolean;
    };
    const isLoading = loadingFieldIds.includes(field.id);
    const isValidating = showPendingFieldTooltip && isFieldUnsignedAndRequired(field);
    const isSignature = field.type === FieldType.SIGNATURE || field.type === FieldType.FREE_SIGNATURE;

    let content: ReactNode;

    if (field.inserted && isSignature) {
      const { image, typed } = signatureOf(field);

      content = image ? (
        <img src={image} alt={t`Signature`} className="h-10 max-w-[220px] object-contain" />
      ) : (
        <span className="font-signature text-2xl leading-none">{typed || t`Signed`}</span>
      );
    } else if (field.inserted) {
      content = <span>{field.customText || '✓'}</span>;
    } else {
      const typeLabel = FIELD_TYPE_LABEL[field.type];

      content = (
        <span>
          {meta.label || meta.placeholder || (typeLabel ? i18n._(typeLabel) : t`Fill in`)}
          {meta.required !== false && !meta.readOnly && <span className="text-red-500"> *</span>}
        </span>
      );
    }

    return (
      <button
        key={field.id}
        type="button"
        id={field.id === nextFieldId ? 'field-tooltip' : undefined}
        data-reflow-field-id={field.id}
        disabled={meta.readOnly || isLoading}
        onClick={() => onFieldClick(field)}
        className={cn(
          'mx-0.5 my-0.5 inline-flex min-h-[34px] max-w-full items-center rounded-md border-2 px-2 py-0.5 text-left align-middle text-[15px] leading-snug transition-colors',
          isSignature && !field.inserted && 'min-w-[160px] py-2',
          field.inserted && 'border-green-500/80 bg-green-50 text-neutral-900',
          !field.inserted && !isValidating && 'border-green-400 bg-green-50/60 text-neutral-500',
          !field.inserted && isValidating && 'border-orange-400 bg-orange-50 text-orange-800',
          meta.readOnly && 'border-neutral-300 bg-neutral-50 text-neutral-500',
        )}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : content}
      </button>
    );
  };

  return (
    <div className="w-full max-w-[680px] rounded-lg border bg-white px-4 py-5 font-sans text-[16px] text-neutral-900 leading-relaxed shadow-sm sm:px-8">
      {blocks.map((block, index) => (
        <p
          key={`${block.page}-${index}`}
          className={cn('mb-3 break-words', block.indent && 'ml-3', block.align === 'center' && 'text-center')}
          style={{ fontSize: `${block.scale}em` }}
        >
          {block.runs.map((run, runIndex) => {
            if (run.kind === 'field') {
              const field = fieldsById.get(run.fieldId);

              return field ? renderField(field) : null;
            }

            return (
              <span key={runIndex} className={cn(run.bold && 'font-bold', run.italic && 'italic')}>
                {run.text}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}
