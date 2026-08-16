export type Viewport = {
  name: string;
  width: number;
};

export const viewports: Viewport[] = [
  { name: 'Mobile', width: 390 },
  { name: 'Tablet', width: 768 },
  { name: 'Desktop', width: 1024 },
];
