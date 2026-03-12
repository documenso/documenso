import type { Page } from '@playwright/test';
import type Konva from 'konva';

export const getKonvaElementCountForPage = async (
  page: Page,
  pageNumber: number,
  elementSelector: string,
) => {
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
