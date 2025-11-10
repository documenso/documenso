import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { FieldType } from '@prisma/client';
import {
  CalendarIcon,
  CheckSquareIcon,
  ContactIcon,
  DiscIcon,
  HashIcon,
  ListIcon,
  MailIcon,
  TextIcon,
  UserIcon,
} from 'lucide-react';

import { getBoundingClientRect } from '@documenso/lib/client-only/get-bounding-client-rect';
import { useDocumentElement } from '@documenso/lib/client-only/hooks/use-document-element';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { FIELD_META_DEFAULT_VALUES } from '@documenso/lib/types/field-meta';
import { nanoid } from '@documenso/lib/universal/id';
import { canRecipientFieldsBeModified } from '@documenso/lib/utils/recipients';
import { SignatureIcon } from '@documenso/ui/icons/signature';
import { RECIPIENT_COLOR_STYLES } from '@documenso/ui/lib/recipient-colors';
import { cn } from '@documenso/ui/lib/utils';
import { FRIENDLY_FIELD_TYPE } from '@documenso/ui/primitives/document-flow/types';

const MIN_HEIGHT_PX = 12;
const MIN_WIDTH_PX = 36;

const DEFAULT_HEIGHT_PX = MIN_HEIGHT_PX * 2.5;
const DEFAULT_WIDTH_PX = MIN_WIDTH_PX * 2.5;

export const fieldButtonList = [
  {
    type: FieldType.SIGNATURE,
    icon: SignatureIcon,
    name: msg`Signature`,
    className: 'font-signature text-lg',
  },
  {
    type: FieldType.EMAIL,
    icon: MailIcon,
    name: msg`Email`,
  },
  {
    type: FieldType.NAME,
    icon: UserIcon,
    name: msg`Name`,
  },
  {
    type: FieldType.INITIALS,
    icon: ContactIcon,
    name: msg`Initials`,
  },
  {
    type: FieldType.DATE,
    icon: CalendarIcon,
    name: msg`Date`,
  },
  {
    type: FieldType.TEXT,
    icon: TextIcon,
    name: msg`Text`,
  },
  {
    type: FieldType.NUMBER,
    icon: HashIcon,
    name: msg`Number`,
  },
  {
    type: FieldType.RADIO,
    icon: DiscIcon,
    name: msg`Radio`,
  },
  {
    type: FieldType.CHECKBOX,
    icon: CheckSquareIcon,
    name: msg`Checkbox`,
  },
  {
    type: FieldType.DROPDOWN,
    icon: ListIcon,
    name: msg`Dropdown`,
  },
];

type EnvelopeEditorFieldDragDropProps = {
  selectedRecipientId: number | null;
  selectedEnvelopeItemId: string | null;
};

export const EnvelopeEditorFieldDragDrop = ({
  selectedRecipientId,
  selectedEnvelopeItemId,
}: EnvelopeEditorFieldDragDropProps) => {
  const { envelope, editorFields, isTemplate, getRecipientColorKey } = useCurrentEnvelopeEditor();

  const { t } = useLingui();

  const [selectedField, setSelectedField] = useState<FieldType | null>(null);

  const { isWithinPageBounds, getPage } = useDocumentElement();

  const isFieldsDisabled = useMemo(() => {
    const selectedSigner = envelope.recipients.find(
      (recipient) => recipient.id === selectedRecipientId,
    );
    const fields = envelope.fields;

    if (!selectedSigner) {
      return true;
    }

    // Allow fields to be modified for templates regardless of anything.
    if (isTemplate) {
      return false;
    }

    return !canRecipientFieldsBeModified(selectedSigner, fields);
  }, [selectedRecipientId, envelope.recipients, envelope.fields]);

  const [isFieldWithinBounds, setIsFieldWithinBounds] = useState(false);
  const [coords, setCoords] = useState({
    x: 0,
    y: 0,
  });

  const fieldBounds = useRef({
    height: 0,
    width: 0,
  });

  const onMouseMove = useCallback(
    (event: MouseEvent) => {
      setIsFieldWithinBounds(
        isWithinPageBounds(
          event,
          PDF_VIEWER_PAGE_SELECTOR,
          fieldBounds.current.width,
          fieldBounds.current.height,
        ),
      );

      setCoords({
        x: event.clientX - fieldBounds.current.width / 2,
        y: event.clientY - fieldBounds.current.height / 2,
      });
    },
    [isWithinPageBounds],
  );

  const onMouseClick = useCallback(
    (event: MouseEvent) => {
      if (!selectedField || !selectedRecipientId || !selectedEnvelopeItemId) {
        return;
      }

      const $page = getPage(event, PDF_VIEWER_PAGE_SELECTOR);

      if (
        !$page ||
        !isWithinPageBounds(
          event,
          PDF_VIEWER_PAGE_SELECTOR,
          fieldBounds.current.width,
          fieldBounds.current.height,
        )
      ) {
        setSelectedField(null);
        return;
      }

      const { top, left, height, width } = getBoundingClientRect($page);

      console.log({
        top,
        left,
        height,
        width,
        rawPageX: event.pageX,
        rawPageY: event.pageY,
      });

      const pageNumber = parseInt($page.getAttribute('data-page-number') ?? '1', 10);

      // Calculate x and y as a percentage of the page width and height
      let pageX = ((event.pageX - left) / width) * 100;
      let pageY = ((event.pageY - top) / height) * 100;

      // Get the bounds as a percentage of the page width and height
      const fieldPageWidth = (fieldBounds.current.width / width) * 100;
      const fieldPageHeight = (fieldBounds.current.height / height) * 100;

      // And center it based on the bounds
      pageX -= fieldPageWidth / 2;
      pageY -= fieldPageHeight / 2;

      const field = {
        formId: nanoid(12),
        envelopeItemId: selectedEnvelopeItemId,
        type: selectedField,
        page: pageNumber,
        positionX: pageX,
        positionY: pageY,
        width: fieldPageWidth,
        height: fieldPageHeight,
        recipientId: selectedRecipientId,
        fieldMeta: structuredClone(FIELD_META_DEFAULT_VALUES[selectedField]),
      };

      editorFields.addField(field);

      setIsFieldWithinBounds(false);
      setSelectedField(null);
    },
    [
      isWithinPageBounds,
      selectedField,
      selectedRecipientId,
      selectedEnvelopeItemId,
      getPage,
      editorFields,
    ],
  );

  useEffect(() => {
    const observer = new MutationObserver((_mutations) => {
      const $page = document.querySelector(PDF_VIEWER_PAGE_SELECTOR);

      if (!$page) {
        return;
      }

      fieldBounds.current = {
        height: Math.max(DEFAULT_HEIGHT_PX),
        width: Math.max(DEFAULT_WIDTH_PX),
      };
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
    if (selectedField) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseClick);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseClick);
    };
  }, [onMouseClick, onMouseMove, selectedField]);

  const selectedRecipientColor = useMemo(() => {
    return selectedRecipientId ? getRecipientColorKey(selectedRecipientId) : 'green';
  }, [selectedRecipientId, getRecipientColorKey]);

  return (
    <>
      <div className="grid grid-cols-2 gap-x-2 gap-y-2.5">
        {fieldButtonList.map((field) => (
          <button
            disabled={isFieldsDisabled}
            key={field.type}
            type="button"
            onClick={() => setSelectedField(field.type)}
            onMouseDown={() => setSelectedField(field.type)}
            data-selected={selectedField === field.type ? true : undefined}
            className={cn(
              'border-border group flex h-12 cursor-pointer items-center justify-center rounded-lg border px-4 transition-colors',
              RECIPIENT_COLOR_STYLES[selectedRecipientColor].fieldButton,
            )}
          >
            <p
              className={cn(
                'text-muted-foreground font-noto group-data-[selected]:text-foreground flex items-center justify-center gap-x-1.5 text-sm font-normal',
                field.className,
                {
                  'group-hover:text-recipient-green': selectedRecipientColor === 'green',
                  'group-hover:text-recipient-blue': selectedRecipientColor === 'blue',
                  'group-hover:text-recipient-purple': selectedRecipientColor === 'purple',
                  'group-hover:text-recipient-orange': selectedRecipientColor === 'orange',
                  'group-hover:text-recipient-yellow': selectedRecipientColor === 'yellow',
                  'group-hover:text-recipient-pink': selectedRecipientColor === 'pink',
                },
              )}
            >
              {field.type !== FieldType.SIGNATURE && <field.icon className="h-4 w-4" />}
              {t(field.name)}
            </p>
          </button>
        ))}
      </div>

      {selectedField && (
        <div
          className={cn(
            'text-muted-foreground dark:text-muted-background font-noto pointer-events-none fixed z-50 flex cursor-pointer flex-col items-center justify-center rounded-[2px] bg-white ring-2 transition duration-200 [container-type:size]',
            RECIPIENT_COLOR_STYLES[selectedRecipientColor].base,
            selectedField === FieldType.SIGNATURE && 'font-signature',
            {
              '-rotate-6 scale-90 opacity-50 dark:bg-black/20': !isFieldWithinBounds,
              'dark:text-black/60': isFieldWithinBounds,
            },
          )}
          style={{
            top: coords.y,
            left: coords.x,
            height: fieldBounds.current.height,
            width: fieldBounds.current.width,
          }}
        >
          <span className="text-[clamp(0.425rem,25cqw,0.825rem)]">
            {t(FRIENDLY_FIELD_TYPE[selectedField])}
          </span>
        </div>
      )}
    </>
  );
};
