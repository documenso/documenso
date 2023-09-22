export const renderCustomEmailTemplate = <T extends Record<string, string>>(
  template: string,
  variables: T,
): string => {
  return template.replace(/\{(\S+)\}/g, (_, key) => {
    if (key in variables) {
      return variables[key];
    }

    return key;
  });
};
