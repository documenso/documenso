export const fromCheckboxValue = (customText: string): string[] => {
  if (!customText) {
    return [];
  }

  try {
    const parsed = JSON.parse(customText);

    if (!Array.isArray(parsed)) {
      throw new Error('Parsed checkbox values are not an array');
    }

    return parsed;
  } catch {
    return customText.split(',').filter(Boolean);
  }
};

export const toCheckboxValue = (values: string[]): string => {
  return JSON.stringify(values);
};
