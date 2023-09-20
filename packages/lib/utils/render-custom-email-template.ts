export const renderCustomEmailTemplate = <T extends Record<string, string>>(
  template: string,
  variables: T,
): string => {
  let t = template;

  Object.entries(variables).forEach((entry) => {
    const [key, value] = entry;

    const placeholder = `{${key}}`;

    const re = new RegExp(placeholder, 'g');

    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      t = t.replace(re, String(value));
    }
  });

  return t;
};
