export const URL_REGEX = {
  test: function (value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },
};
