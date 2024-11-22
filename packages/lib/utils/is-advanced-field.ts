const ADVANCED_FIELD_TYPES = ['NUMBER', 'TEXT', 'DROPDOWN', 'RADIO', 'CHECKBOX'];

export function isAdvancedField(fieldType: string) {
  return ADVANCED_FIELD_TYPES.includes(fieldType);
}
