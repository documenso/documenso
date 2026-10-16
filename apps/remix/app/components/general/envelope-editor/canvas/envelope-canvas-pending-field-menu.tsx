import { useLingui } from '@lingui/react/macro';
import type { FieldType } from '@prisma/client';

import { fieldButtonList } from '../envelope-editor-fields-drag-drop';

type EnvelopeCanvasPendingFieldMenuProps = {
  onSelectType: (type: FieldType) => void;
};

/**
 * The field type picker shown after drawing a marquee on an empty area of the
 * page, to create a field of that size.
 */
export const EnvelopeCanvasPendingFieldMenu = ({ onSelectType }: EnvelopeCanvasPendingFieldMenuProps) => {
  const { t } = useLingui();

  return (
    <div
      // Don't use darkmode for this component, it should look the same for both light/dark modes.
      className="grid w-max grid-cols-5 gap-x-1 gap-y-0.5 rounded-md border border-gray-300 bg-white p-1 text-gray-500 shadow-sm"
    >
      {fieldButtonList.map((field) => (
        <button
          key={field.type}
          type="button"
          onClick={() => onSelectType(field.type)}
          className="col-span-1 w-full flex-shrink-0 rounded-sm px-2 py-1 text-xs hover:bg-gray-100 hover:text-gray-600"
        >
          {t(field.name)}
        </button>
      ))}
    </div>
  );
};
