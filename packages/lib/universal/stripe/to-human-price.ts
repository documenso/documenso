export const toHumanPrice = (price: number) => {
  return Number(price / 100).toFixed(2);
};
