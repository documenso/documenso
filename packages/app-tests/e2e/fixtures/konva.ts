import type { Page } from '@playwright/test';
import type Konva from 'konva';

export const getKonvaElementCountForPage = async (page: Page, pageNumber: number, elementSelector: string) => {
  await page.locator('.konva-container canvas').first().waitFor({ state: 'visible' });

  return await page.evaluate(
    ({ pageNumber, elementSelector }) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const konva: typeof Konva = (window as unknown as { Konva: typeof Konva }).Konva;

      const pageOne = konva.stages.find((stage) => stage.attrs.id === `page-${pageNumber}`);

      return pageOne?.find(elementSelector).length || 0;
    },
    { pageNumber, elementSelector },
  );
};

/**
 * Returns how many field groups are currently attached to the page's Konva
 * transformer, i.e. the size of the active canvas selection. Used to assert
 * multi-select behaviour (marquee drag and Shift+click).
 */
export const getKonvaTransformerNodeCountForPage = async (page: Page, pageNumber: number) => {
  await page.locator('.konva-container canvas').first().waitFor({ state: 'visible' });

  return await page.evaluate(
    ({ pageNumber }) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const konva: typeof Konva = (window as unknown as { Konva: typeof Konva }).Konva;

      const stage = konva.stages.find((stage) => stage.attrs.id === `page-${pageNumber}`);

      if (!stage) {
        return 0;
      }

      const transformer = stage.find('Transformer')[0];

      if (!transformer) {
        return 0;
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return (transformer as Konva.Transformer).nodes().length;
    },
    { pageNumber },
  );
};

/**
 * Fires a pointerdown on a specific checkbox or radio option inside a field rendered on
 * the signing page canvas, which the signer page renderer treats as the option being clicked.
 *
 * Options are located by the internal index attribute the renderer attaches to each option shape.
 */
export const clickKonvaFieldOption = async (
  page: Page,
  pageNumber: number,
  fieldId: number,
  option: { type: 'checkbox' | 'radio'; index: number },
) => {
  await page.locator('.konva-container canvas').first().waitFor({ state: 'visible' });

  const didFire = await page.evaluate(
    ({ pageNumber, fieldId, option }) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const konva: typeof Konva = (window as unknown as { Konva: typeof Konva }).Konva;

      const stage = konva.stages.find((stage) => stage.attrs.id === `page-${pageNumber}`);
      const fieldGroup = stage?.findOne(`#${fieldId}`);

      if (!fieldGroup || !(fieldGroup instanceof konva.Group)) {
        return false;
      }

      const attributeName = option.type === 'checkbox' ? 'internalCheckboxIndex' : 'internalRadioIndex';

      const optionNode = fieldGroup.find((node: Konva.Node) => node.getAttr(attributeName) === option.index)[0];

      if (!optionNode) {
        return false;
      }

      optionNode.fire('pointerdown', {}, true);

      return true;
    },
    { pageNumber, fieldId, option },
  );

  if (!didFire) {
    throw new Error(`Unable to find ${option.type} option ${option.index} for field ${fieldId} on page ${pageNumber}`);
  }
};

/**
 * Returns the text a field renders on the page's canvas: its inserted value once
 * signed, otherwise its label or field type name.
 */
export const getKonvaFieldTextForPage = async (page: Page, pageNumber: number, fieldId: number) => {
  await page.locator('.konva-container canvas').first().waitFor({ state: 'visible' });

  return await page.evaluate(
    ({ pageNumber, fieldId }) => {
      const konva: typeof Konva = (window as unknown as { Konva: typeof Konva }).Konva;

      const stage = konva.stages.find((stage) => stage.attrs.id === `page-${pageNumber}`);

      return stage?.findOne<Konva.Text>(`#${fieldId}-text`)?.text() ?? null;
    },
    { pageNumber, fieldId },
  );
};

/**
 * The opacity of the group highlight overlay on a signing page field, or null when the
 * field is not highlighted as part of the active group.
 */
export const getKonvaFieldGroupHighlight = async (
  page: Page,
  pageNumber: number,
  fieldId: number,
): Promise<number | null> => {
  return await page.evaluate(
    ({ pageNumber, fieldId }) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const konva: typeof Konva = (window as unknown as { Konva: typeof Konva }).Konva;

      const stage = konva.stages.find((stage) => stage.attrs.id === `page-${pageNumber}`);
      const fieldGroup = stage?.findOne(`#${fieldId}`);

      if (!fieldGroup || !(fieldGroup instanceof konva.Group)) {
        return null;
      }

      const highlight = fieldGroup.findOne('.group-highlight');

      return highlight ? highlight.opacity() : null;
    },
    { pageNumber, fieldId },
  );
};

/**
 * The opacity of the group highlight overlay on the field at a canvas position, or null
 * when that field is not highlighted. For the editor, whose fields are keyed by form IDs.
 */
export const getKonvaFieldGroupHighlightAt = async (
  page: Page,
  pageNumber: number,
  position: { x: number; y: number },
): Promise<number | null> => {
  return await page.evaluate(
    ({ pageNumber, position }) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const konva: typeof Konva = (window as unknown as { Konva: typeof Konva }).Konva;

      const stage = konva.stages.find((stage) => stage.attrs.id === `page-${pageNumber}`);

      const fieldGroup = stage?.find('.field-group').find((node) => {
        const rect = node.getClientRect();

        return (
          position.x >= rect.x &&
          position.x <= rect.x + rect.width &&
          position.y >= rect.y &&
          position.y <= rect.y + rect.height
        );
      });

      if (!(fieldGroup instanceof konva.Group)) {
        return null;
      }

      const highlight = fieldGroup.findOne('.group-highlight');

      return highlight ? highlight.opacity() : null;
    },
    { pageNumber, position },
  );
};

/**
 * Whether a field on the signing page canvas currently shows its loading spinner.
 */
export const hasKonvaFieldSpinner = async (page: Page, pageNumber: number, fieldId: number): Promise<boolean> => {
  return await page.evaluate(
    ({ pageNumber, fieldId }) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const konva: typeof Konva = (window as unknown as { Konva: typeof Konva }).Konva;

      const stage = konva.stages.find((stage) => stage.attrs.id === `page-${pageNumber}`);
      const fieldGroup = stage?.findOne(`#${fieldId}`);

      if (!fieldGroup || !(fieldGroup instanceof konva.Group)) {
        return false;
      }

      return fieldGroup.findOne('.loading-spinner-group') !== undefined;
    },
    { pageNumber, fieldId },
  );
};

/**
 * The on-screen box of a checkbox or radio option's input, relative to its page canvas.
 */
export const getKonvaFieldOptionInputRect = async (
  page: Page,
  pageNumber: number,
  fieldId: number,
  option: { type: 'checkbox' | 'radio'; index: number },
) => {
  const rect = await page.evaluate(
    ({ pageNumber, fieldId, option }) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const konva: typeof Konva = (window as unknown as { Konva: typeof Konva }).Konva;

      const stage = konva.stages.find((stage) => stage.attrs.id === `page-${pageNumber}`);
      const fieldGroup = stage?.findOne(`#${fieldId}`);

      if (!fieldGroup || !(fieldGroup instanceof konva.Group)) {
        return null;
      }

      const inputName = option.type === 'checkbox' ? 'checkbox-square' : 'radio-circle';
      const input = fieldGroup.findOne(`#${inputName}-${option.index}`);

      return input ? input.getClientRect() : null;
    },
    { pageNumber, fieldId, option },
  );

  if (!rect) {
    throw new Error(`Option ${option.index} of field ${fieldId} not found on page ${pageNumber}`);
  }

  return rect;
};

/**
 * Returns the text rendered next to each option of a checkbox or radio field, in order.
 */
export const getKonvaOptionTexts = async (
  page: Page,
  pageNumber: number,
  fieldId: number,
  type: 'checkbox' | 'radio',
): Promise<string[]> => {
  return await page.evaluate(
    ({ pageNumber, fieldId, type }) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const konva: typeof Konva = (window as unknown as { Konva: typeof Konva }).Konva;

      const stage = konva.stages.find((stage) => stage.attrs.id === `page-${pageNumber}`);
      const fieldGroup = stage?.findOne(`#${fieldId}`);

      if (!fieldGroup || !(fieldGroup instanceof konva.Group)) {
        return [];
      }

      return (
        fieldGroup
          .find(`.${type}-text`)
          .sort((a, b) => a.id().localeCompare(b.id()))
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          .map((node) => (node as Konva.Text).text())
      );
    },
    { pageNumber, fieldId, type },
  );
};
