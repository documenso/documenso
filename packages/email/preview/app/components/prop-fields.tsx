import type { FieldConfig } from '../lib/templates';

type PropFieldsProps = {
  fields: Record<string, FieldConfig>;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
};

export const PropFields = ({ fields, values, onChange }: PropFieldsProps) => {
  const entries = Object.entries(fields);

  if (entries.length === 0) {
    return <p className="text-neutral-400 text-xs">No editable props.</p>;
  }

  return (
    <div className="grid gap-3">
      {entries.map(([key, field]) => (
        <PropField key={key} name={key} field={field} value={values[key]} onChange={(value) => onChange(key, value)} />
      ))}
    </div>
  );
};

type PropFieldProps = {
  name: string;
  field: FieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
};

const inputClass =
  'w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-neutral-900 text-xs focus:border-neutral-500 focus:outline-none';

const PropField = ({ name, field, value, onChange }: PropFieldProps) => {
  const id = `prop-${name}`;

  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="font-medium text-neutral-600 text-xs">
        {field.label}
      </label>

      {field.type === 'text' && (
        <input
          id={id}
          className={inputClass}
          value={String(value ?? '')}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {field.type === 'textarea' && (
        <textarea
          id={id}
          className={`${inputClass} min-h-16 resize-y font-mono`}
          value={String(value ?? '')}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {field.type === 'number' && (
        <input
          id={id}
          type="number"
          className={inputClass}
          value={value === undefined || value === null ? '' : String(value)}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
        />
      )}

      {field.type === 'boolean' && (
        <input
          id={id}
          type="checkbox"
          className="h-4 w-4"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
      )}

      {field.type === 'list' && (
        <textarea
          id={id}
          className={`${inputClass} min-h-16 resize-y font-mono`}
          value={Array.isArray(value) ? value.join('\n') : ''}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value === '' ? [] : event.target.value.split('\n'))}
        />
      )}

      {field.type === 'select' && field.options && (
        <select
          id={id}
          className={inputClass}
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {field.description && <p className="text-neutral-400 text-xs">{field.description}</p>}
    </div>
  );
};
