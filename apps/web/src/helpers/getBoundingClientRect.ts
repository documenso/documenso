export const getBoundingClientRect = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();

  const { width, height } = rect;

  const top = rect.top + window.scrollY;
  const left = rect.left + window.scrollX;

  return { top, left, width, height };
};
