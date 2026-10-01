import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@documenso/ui/primitives/command';
import { FRIENDLY_FIELD_TYPE } from '@documenso/ui/primitives/document-flow/types';
import { useLingui } from '@lingui/react/macro';
import type { FieldType } from '@prisma/client';
import { CopyPlusIcon, ShapesIcon, SquareStackIcon, TrashIcon, UserCircleIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { fieldButtonList } from '../envelope-editor-fields-drag-drop';
import { EnvelopeRecipientSelectorCommand } from '../envelope-recipient-selector';
import { EnvelopeCanvasActionButton, EnvelopeCanvasActionButtonGroup } from './envelope-canvas-action-bar';

type EnvelopeCanvasFieldActionButtonsProps = {
  selectedFieldFormIds: string[];
  onDuplicate: () => void;
  onDuplicateOnAllPages: () => void;
  onDelete: () => void;
  onChangeRecipient: (recipientId: number) => void;
  onChangeFieldType: (type: FieldType) => void;
};

/**
 * The floating actions for the selected fields.
 */
export const EnvelopeCanvasFieldActionButtons = ({
  selectedFieldFormIds,
  onDuplicate,
  onDuplicateOnAllPages,
  onDelete,
  onChangeRecipient,
  onChangeFieldType,
}: EnvelopeCanvasFieldActionButtonsProps) => {
  const { t } = useLingui();

  const [showRecipientSelector, setShowRecipientSelector] = useState(false);
  const [showFieldTypeSelector, setShowFieldTypeSelector] = useState(false);

  const { editorFields, envelope } = useCurrentEnvelopeEditor();

  const selectedFields = useMemo(
    () => editorFields.localFields.filter((field) => selectedFieldFormIds.includes(field.formId)),
    [editorFields.localFields, selectedFieldFormIds],
  );

  /**
   * Decide the preselected field type in the command input.
   *
   * If all fields share the same type, use that as the default selection.
   * Otherwise show no preselection.
   */
  const preselectedFieldType = useMemo(() => {
    if (selectedFields.length === 0) {
      return null;
    }

    const firstType = selectedFields[0].type;
    const isTypesSame = selectedFields.every((field) => field.type === firstType);

    return isTypesSame ? firstType : null;
  }, [selectedFields]);

  /**
   * Decide the preselected recipient in the command input.
   *
   * If all fields belong to the same recipient then use that recipient as the default.
   *
   * Otherwise show the placeholder.
   */
  const preselectedRecipient = useMemo(() => {
    if (selectedFields.length === 0) {
      return null;
    }

    const recipient = envelope.recipients.find((recipient) => recipient.id === selectedFields[0].recipientId);

    if (!recipient) {
      return null;
    }

    const isRecipientsSame = selectedFields.every((field) => field.recipientId === recipient.id);

    return isRecipientsSame ? recipient : null;
  }, [selectedFields, envelope.recipients]);

  return (
    <>
      <EnvelopeCanvasActionButtonGroup>
        <EnvelopeCanvasActionButton
          title={t`Change Recipient`}
          icon={UserCircleIcon}
          onClick={() => setShowRecipientSelector(true)}
        />

        <EnvelopeCanvasActionButton
          title={t`Change Field Type`}
          icon={ShapesIcon}
          onClick={() => setShowFieldTypeSelector(true)}
        />

        <EnvelopeCanvasActionButton title={t`Duplicate`} icon={CopyPlusIcon} onClick={onDuplicate} />

        <EnvelopeCanvasActionButton
          title={t`Duplicate on all pages`}
          icon={SquareStackIcon}
          onClick={onDuplicateOnAllPages}
        />

        <EnvelopeCanvasActionButton title={t`Remove`} icon={TrashIcon} onClick={onDelete} />
      </EnvelopeCanvasActionButtonGroup>

      <CommandDialog position="start" open={showRecipientSelector} onOpenChange={setShowRecipientSelector}>
        <EnvelopeRecipientSelectorCommand
          placeholder={t`Select a recipient`}
          selectedRecipient={preselectedRecipient}
          onSelectedRecipientChange={(recipient) => {
            editorFields.setSelectedRecipient(recipient.id);
            onChangeRecipient(recipient.id);
            setShowRecipientSelector(false);
          }}
          recipients={envelope.recipients}
          fields={envelope.fields}
        />
      </CommandDialog>

      <CommandDialog position="start" open={showFieldTypeSelector} onOpenChange={setShowFieldTypeSelector}>
        <Command defaultValue={preselectedFieldType ? t(FRIENDLY_FIELD_TYPE[preselectedFieldType]) : undefined}>
          <CommandInput placeholder={t`Select a field type`} />

          <CommandList>
            <CommandEmpty>
              <span className="inline-block px-4 text-muted-foreground">
                {t`No field type matching this description was found.`}
              </span>
            </CommandEmpty>

            <CommandGroup>
              {fieldButtonList.map((field) => {
                const FieldIcon = field.icon;
                const label = t(FRIENDLY_FIELD_TYPE[field.type]);

                return (
                  <CommandItem
                    key={field.type}
                    className="px-2"
                    onSelect={() => {
                      onChangeFieldType(field.type);
                      setShowFieldTypeSelector(false);
                    }}
                  >
                    <FieldIcon className="mr-2 h-4 w-4" />
                    <span className="truncate">{label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
};
