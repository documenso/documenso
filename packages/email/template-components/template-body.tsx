import React from 'react';

export type TemplateBodyProps = {
  text?: string;
};

export const TemplateBody = ({ text }: TemplateBodyProps) => {
  if (!text) return null;

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const paragraphs = normalized.split(/\n\s*\n+/);

  return (
    <>
      {paragraphs.map((para, pIdx) => {
        const lines = para.split('\n');
        return (
          <p
            key={`p-${pIdx}`}
            className="whitespace-pre-line break-words font-sans text-base text-slate-400"
          >
            {lines.map((line, i) => (
              <React.Fragment key={`line-${pIdx}-${i}`}>
                {i > 0 && <br />}
                {line}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
};

export default TemplateBody;
