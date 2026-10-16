import { useLingui } from '@lingui/react/macro';

import type { ContentDragDropItem } from '../envelope-editor-content-drag-drop';

type EnvelopeCanvasPendingContentMenuProps = {
  /**
   * The palette items on offer, e.g. without images once the organisation's
   * image allowance is used up.
   */
  items: ContentDragDropItem[];

  onSelectItem: (item: ContentDragDropItem) => void;
};

/**
 * The content type picker shown after drawing a marquee on an empty area of
 * the page while editing contents, to create a content of that size.
 */
export const EnvelopeCanvasPendingContentMenu = ({ items, onSelectItem }: EnvelopeCanvasPendingContentMenuProps) => {
  const { t } = useLingui();

  return (
    <div
      // Don't use darkmode for this component, it should look the same for both light/dark modes.
      className="flex w-max items-center gap-x-1 rounded-md border border-gray-300 bg-white p-1 text-gray-500 shadow-sm"
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onSelectItem(item)}
          className="flex flex-shrink-0 items-center gap-x-1.5 rounded-sm px-2 py-1 text-xs hover:bg-gray-100 hover:text-gray-600"
        >
          <item.icon className="h-3.5 w-3.5" />
          {t(item.name)}
        </button>
      ))}
    </div>
  );
};
