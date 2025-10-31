export type TDetectedFormField = {
  boundingBox: number[];
  label:
    | 'SIGNATURE'
    | 'INITIALS'
    | 'NAME'
    | 'EMAIL'
    | 'DATE'
    | 'TEXT'
    | 'NUMBER'
    | 'RADIO'
    | 'CHECKBOX'
    | 'DROPDOWN';
};
