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
