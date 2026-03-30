import * as React from 'react';

const PREVIEW_MAX_LENGTH = 150;

/**
 * Custom Preview component that replaces @react-email/preview.
 *
 * The original component pads preview text with zero-width Unicode characters
 * (U+200C, U+200B, U+200D, U+200E, U+200F, U+FEFF) to prevent email clients
 * from showing body text in the preview snippet. When these multi-byte characters
 * are quoted-printable encoded by Nodemailer, they expand ~3x in size, creating
 * a massive block of encoded content before the visible <body>. This causes
 * SendGrid (and potentially other SMTP relays) to truncate the HTML, resulting
 * in empty emails with no visible content or signing buttons.
 *
 * This version uses ASCII spaces and non-breaking spaces instead, which encode
 * efficiently in both quoted-printable and base64.
 */
export const Preview = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(
  ({ children = '', ...props }, ref) => {
    const text = (Array.isArray(children) ? children.join('') : String(children)).substring(
      0,
      PREVIEW_MAX_LENGTH,
    );

    const paddingLength = Math.max(0, PREVIEW_MAX_LENGTH - text.length);

    // Use alternating ASCII space + non-breaking space (both single-byte in QP)
    // This prevents email clients from collapsing the whitespace while staying
    // compact in quoted-printable encoding.
    const padding =
      paddingLength > 0 ? '\u00A0 '.repeat(paddingLength).substring(0, paddingLength * 2) : '';

    return (
      <div
        style={{
          display: 'none',
          overflow: 'hidden',
          lineHeight: '1px',
          opacity: 0,
          maxHeight: 0,
          maxWidth: 0,
        }}
        data-skip-in-text={true}
        {...props}
        ref={ref}
      >
        {text}
        {padding && <div>{padding}</div>}
      </div>
    );
  },
);

Preview.displayName = 'Preview';
