import { useEffect, useMemo, useRef } from 'react';

import { useLingui } from '@lingui/react/macro';
import { type Field, FieldType } from '@prisma/client';
import Konva from 'konva';
import type { Layer } from 'konva/lib/Layer';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { RenderParameters } from 'pdfjs-dist/types/src/display/api';
import { usePageContext } from 'react-pdf';
import { match } from 'ts-pattern';

import { useCurrentEnvelopeRender } from '@documenso/lib/client-only/providers/envelope-render-provider';
import { ZFullFieldSchema } from '@documenso/lib/types/field';
import { createSpinner } from '@documenso/lib/universal/field-renderer/field-generic-items';
import { renderField } from '@documenso/lib/universal/field-renderer/render-field';
import { isFieldUnsignedAndRequired } from '@documenso/lib/utils/advanced-fields-helpers';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import type { TRecipientColor } from '@documenso/ui/lib/recipient-colors';

import { handleDropdownFieldClick } from '~/utils/field-signing/dropdown-field';
import { handleEmailFieldClick } from '~/utils/field-signing/email-field';
import { handleInitialsFieldClick } from '~/utils/field-signing/initial-field';
import { handleNameFieldClick } from '~/utils/field-signing/name-field';
import { handleNumberFieldClick } from '~/utils/field-signing/number-field';
import { handleSignatureFieldClick } from '~/utils/field-signing/signature-field';
import { handleTextFieldClick } from '~/utils/field-signing/text-field';

import { useRequiredEnvelopeSigningContext } from '../document-signing/envelope-signing-provider';

export default function EnvelopeSignerPageRenderer() {
  const pageContext = usePageContext();

  if (!pageContext) {
    throw new Error('Unable to find Page context.');
  }

  const { _className, page, rotate, scale } = pageContext;

  if (!page) {
    throw new Error('Attempted to render page canvas, but no page was specified.');
  }

  const { t } = useLingui();

  const { currentEnvelopeItem } = useCurrentEnvelopeRender();

  const {
    envelopeData,
    recipientFields,
    recipientFieldsRemaining,
    showPendingFieldTooltip,
    signField,
    email,
    setEmail,
    fullName,
    setFullName,
    signature,
    setSignature,
  } = useRequiredEnvelopeSigningContext();

  console.log({ fullName });

  const { envelope } = envelopeData;

  const canvasElement = useRef<HTMLCanvasElement>(null);
  const konvaContainer = useRef<HTMLDivElement>(null);

  const stage = useRef<Konva.Stage | null>(null);
  const pageLayer = useRef<Layer | null>(null);

  const viewport = useMemo(
    () => page.getViewport({ scale, rotation: rotate }),
    [page, rotate, scale],
  );

  const localPageFields = useMemo(
    () =>
      recipientFields.filter(
        (field) =>
          field.page === pageContext.pageNumber && field.envelopeItemId === currentEnvelopeItem?.id,
      ),
    [recipientFields, pageContext.pageNumber],
  );

  // Custom renderer from Konva examples.
  useEffect(
    function drawPageOnCanvas() {
      if (!page) {
        return;
      }

      const { current: canvas } = canvasElement;
      const { current: container } = konvaContainer;

      if (!canvas || !container) {
        return;
      }

      const renderContext: RenderParameters = {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        canvasContext: canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D,
        viewport,
      };

      const cancellable = page.render(renderContext);
      const runningTask = cancellable;

      cancellable.promise.catch(() => {
        // Intentionally empty
      });

      void cancellable.promise.then(() => {
        createPageCanvas(container);
      });

      return () => {
        runningTask.cancel();
      };
    },
    [page, viewport],
  );

  const renderFieldOnLayer = (unparsedField: Field) => {
    if (!pageLayer.current) {
      console.error('Layer not loaded yet');
      return;
    }

    const fieldToRender = ZFullFieldSchema.parse(unparsedField);

    let color: TRecipientColor = 'green';

    if (fieldToRender.fieldMeta?.readOnly) {
      color = 'readOnly';
    } else if (showPendingFieldTooltip && isFieldUnsignedAndRequired(fieldToRender)) {
      color = 'orange';
    }

    const { fieldGroup } = renderField({
      pageLayer: pageLayer.current,
      field: {
        renderId: fieldToRender.id.toString(),
        ...fieldToRender,
        width: Number(fieldToRender.width),
        height: Number(fieldToRender.height),
        positionX: Number(fieldToRender.positionX),
        positionY: Number(fieldToRender.positionY),
      },
      pageWidth: viewport.width,
      pageHeight: viewport.height,
      color,
      mode: 'sign',
    });

    const handleFieldGroupClick = (e: KonvaEventObject<Event>) => {
      const currentTarget = e.currentTarget as Konva.Group;
      const target = e.target;

      const { width: fieldWidth, height: fieldHeight } = fieldGroup.getClientRect();

      const foundField = recipientFields.find((f) => f.id === unparsedField.id);
      const foundLoadingGroup = currentTarget.findOne('.loading-spinner-group');

      if (!foundField || foundLoadingGroup || foundField.fieldMeta?.readOnly) {
        return;
      }

      const loadingSpinnerGroup = createSpinner({
        fieldWidth,
        fieldHeight,
      });

      fieldGroup.add(loadingSpinnerGroup);

      const parsedFoundField = ZFullFieldSchema.parse(foundField);

      match(parsedFoundField)
        /**
         * CHECKBOX FIELD.
         */
        .with({ type: FieldType.CHECKBOX }, (field) => {
          const { fieldMeta } = field;

          const { values } = fieldMeta;

          const checkedValues = (values || [])
            .map((v) => ({
              ...v,
              checked: v.id === target.getAttr('internalCheckboxId') ? !v.checked : v.checked,
            }))
            .filter((v) => v.checked);

          void signField(field.id, {
            type: FieldType.CHECKBOX,
            value: checkedValues.map((v) => v.id),
          }).finally(() => {
            loadingSpinnerGroup.destroy();
          });
        })
        /**
         * RADIO FIELD.
         */
        .with({ type: FieldType.RADIO }, (field) => {
          const { fieldMeta } = foundField;

          const checkedValue = target.getAttr('internalRadioValue');

          // Uncheck the value if it's already pressed.
          const value = field.inserted && checkedValue === field.customText ? null : checkedValue;

          void signField(field.id, {
            type: FieldType.RADIO,
            value,
          }).finally(() => {
            loadingSpinnerGroup.destroy();
          });
        })
        /**
         * NUMBER FIELD.
         */
        .with({ type: FieldType.NUMBER }, (field) => {
          handleNumberFieldClick({ field, number: null })
            .then(async (payload) => {
              if (payload) {
                await signField(field.id, payload);
              }
            })
            .finally(() => {
              loadingSpinnerGroup.destroy();
            });
        })
        /**
         * TEXT FIELD.
         */
        .with({ type: FieldType.TEXT }, (field) => {
          handleTextFieldClick({ field, text: null })
            .then(async (payload) => {
              if (payload) {
                await signField(field.id, payload);
              }
            })
            .finally(() => {
              loadingSpinnerGroup.destroy();
            });
        })
        /**
         * EMAIL FIELD.
         */
        .with({ type: FieldType.EMAIL }, (field) => {
          handleEmailFieldClick({ field, email })
            .then(async (payload) => {
              if (payload) {
                await signField(field.id, payload); // Todo: Envelopes - Handle errors
              }

              if (payload?.value) {
                setEmail(payload.value);
              }
            })
            .finally(() => {
              loadingSpinnerGroup.destroy();
            });
        })
        /**
         * INITIALS FIELD.
         */
        .with({ type: FieldType.INITIALS }, (field) => {
          const initials = fullName ? extractInitials(fullName) : null;

          handleInitialsFieldClick({ field, initials })
            .then(async (payload) => {
              if (payload) {
                await signField(field.id, payload);
              }
            })
            .finally(() => {
              loadingSpinnerGroup.destroy();
            });
        })
        /**
         * NAME FIELD.
         */
        .with({ type: FieldType.NAME }, (field) => {
          handleNameFieldClick({ field, name: fullName })
            .then(async (payload) => {
              if (payload) {
                await signField(field.id, payload);
              }

              if (payload?.value) {
                setFullName(payload.value);
              }
            })
            .finally(() => {
              loadingSpinnerGroup.destroy();
            });
        })
        /**
         * DROPDOWN FIELD.
         */
        .with({ type: FieldType.DROPDOWN }, (field) => {
          handleDropdownFieldClick({ field, text: null })
            .then(async (payload) => {
              if (payload) {
                await signField(field.id, payload);
              }

              loadingSpinnerGroup.destroy();
            })
            .finally(() => {
              loadingSpinnerGroup.destroy();
            });
        })
        /**
         * DATE FIELD.
         */
        .with({ type: FieldType.DATE }, (field) => {
          void signField(field.id, {
            type: FieldType.DATE,
            value: !field.inserted,
          }).finally(() => {
            loadingSpinnerGroup.destroy();
          });
        })
        /**
         * SIGNATURE FIELD.
         */
        .with({ type: FieldType.SIGNATURE }, (field) => {
          // Todo: Envelopes - Reauth
          handleSignatureFieldClick({
            field,
            signature,
            typedSignatureEnabled: envelope.documentMeta.typedSignatureEnabled,
            uploadSignatureEnabled: envelope.documentMeta.uploadSignatureEnabled,
            drawSignatureEnabled: envelope.documentMeta.drawSignatureEnabled,
          })
            .then(async (payload) => {
              if (payload) {
                await signField(field.id, payload);
              }

              if (payload?.value) {
                setSignature(payload.value);
              }
            })
            .finally(() => {
              loadingSpinnerGroup.destroy();
            });
        })
        .exhaustive();

      console.log('Field clicked');
    };

    fieldGroup.off('click');
    fieldGroup.on('click', handleFieldGroupClick);
  };

  /**
   * Create the initial Konva page canvas and initialize all fields and interactions.
   */
  const createPageCanvas = (container: HTMLDivElement) => {
    stage.current = new Konva.Stage({
      container,
      width: viewport.width,
      height: viewport.height,
    });

    // Create the main layer for interactive elements.
    pageLayer.current = new Konva.Layer();
    stage.current?.add(pageLayer.current);

    console.log({
      localPageFields,
    });

    // Render the fields.
    for (const field of localPageFields) {
      renderFieldOnLayer(field);
    }

    pageLayer.current.batchDraw();
  };

  /**
   * Render fields when they are changed or inserted.
   */
  useEffect(() => {
    if (!pageLayer.current || !stage.current) {
      return;
    }

    localPageFields.forEach((field) => {
      console.log('Field changed/inserted, rendering on canvas');
      renderFieldOnLayer(field);
    });

    pageLayer.current.batchDraw();
  }, [localPageFields, showPendingFieldTooltip, fullName, signature, email]);

  if (!currentEnvelopeItem) {
    return null;
  }

  return (
    <div className="relative" key={`${currentEnvelopeItem.id}-renderer-${pageContext.pageNumber}`}>
      <div className="konva-container absolute inset-0 z-10 w-full" ref={konvaContainer}></div>

      <canvas
        className={`${_className}__canvas z-0`}
        height={viewport.height}
        ref={canvasElement}
        width={viewport.width}
      />
    </div>
  );
}
