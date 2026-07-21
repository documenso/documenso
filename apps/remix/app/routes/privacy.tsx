import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { msg } from '@lingui/core/macro';
import { Link } from 'react-router';

import { BrandingLogo } from '~/components/general/branding-logo';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Privacy Policy`);
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 md:py-16">
      <Link to="/" className="mb-8 flex items-center gap-x-2">
        <BrandingLogo className="h-8 w-auto" />
      </Link>

      <Alert variant="destructive" className="mb-8">
        <AlertTitle>Draft — not yet reviewed</AlertTitle>
        <AlertDescription>
          This is a placeholder draft generated to unblock development. It has not been reviewed by a lawyer and
          contains bracketed placeholders that must be filled in before this page is used with real users. Remove this
          notice once finalized.
        </AlertDescription>
      </Alert>

      <article className="prose dark:prose-invert max-w-none">
        <h1>Privacy Policy</h1>
        <p>
          <strong>Effective date:</strong> [INSERT EFFECTIVE DATE]
        </p>

        <p>
          This Privacy Policy explains how DataThink ("we," "us," or "our") collects, uses, and protects information
          when you use Keep Contracts (the "Service").
        </p>

        <h2>1. Information We Collect</h2>
        <ul>
          <li>
            <strong>Account information:</strong> name, email address, and password (stored as a secure hash, never in
            plain text).
          </li>
          <li>
            <strong>Document content:</strong> documents, fields, and signatures you upload or create in order to use
            the Service.
          </li>
          <li>
            <strong>Usage data:</strong> IP address, browser type, device information, and pages visited, collected
            automatically to operate and secure the Service.
          </li>
        </ul>
        <p>
          Keep Contracts does not currently use third-party analytics or advertising tracking tools. If this changes,
          this Policy will be updated before any such tool is introduced.
        </p>

        <h2>2. How We Use Information</h2>
        <ul>
          <li>To provide, maintain, and improve the Service;</li>
          <li>To authenticate your account and protect it against unauthorized access;</li>
          <li>To communicate with you about your account or the Service, such as document signing notifications;</li>
          <li>To comply with applicable legal obligations.</li>
        </ul>

        <h2>3. Legal Basis for Processing (EEA/UK Users)</h2>
        <p>
          Where the GDPR applies, we process your personal data on the basis of: performance of a contract (providing
          the Service to you), our legitimate interests (securing and improving the Service), and compliance with legal
          obligations.
        </p>

        <h2>4. Sharing of Information</h2>
        <p>
          We do not sell your personal information. We share information only with service providers necessary to
          operate the Service (for example, hosting and email delivery providers), each under obligations to protect
          your information, or when required by law.
        </p>
        <p>
          Keep Contracts does not currently use a third-party payment processor. If billing is introduced in the future,
          this Policy will be updated to name the relevant provider before it is used.
        </p>

        <h2>5. Data Retention</h2>
        <p>
          We retain your information for as long as your account is active or as needed to provide the Service, comply
          with legal obligations, resolve disputes, and enforce our agreements.
        </p>

        <h2>6. Your Rights</h2>
        <p>
          Depending on your location, you may have the right to access, correct, delete, restrict, or receive a copy of
          your personal data, and to object to certain processing.
        </p>
        <ul>
          <li>
            <strong>EEA/UK (GDPR):</strong> the rights above, plus the right to lodge a complaint with your local data
            protection authority.
          </li>
          <li>
            <strong>California (CCPA):</strong> the right to know what personal information we collect and to request
            its deletion. We do not sell or share personal information for cross-context behavioral advertising.
          </li>
        </ul>
        <p>To exercise these rights, contact us at [INSERT PRIVACY CONTACT EMAIL].</p>

        <h2>7. Security</h2>
        <p>
          We use reasonable technical and organizational measures, such as encryption in transit and access controls, to
          protect your information. No method of transmission or storage is completely secure.
        </p>

        <h2>8. Cookies</h2>
        <p>
          We use only essential cookies required for authentication and security, such as session cookies. We do not
          currently use advertising or analytics cookies.
        </p>

        <h2>9. Children's Privacy</h2>
        <p>
          Keep Contracts is not intended for use by anyone under 18. We do not knowingly collect personal information
          from children.
        </p>

        <h2>10. International Data Transfers</h2>
        <p>
          Your information may be processed in a country other than your own. [INSERT DETAILS ON HOSTING LOCATION(S) AND
          SAFEGUARDS, IF APPLICABLE.]
        </p>

        <h2>11. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Material changes will be communicated before they take
          effect.
        </p>

        <h2>12. Contact Us</h2>
        <p>
          Questions about this Policy can be sent to [INSERT PRIVACY CONTACT EMAIL]. For security concerns, contact{' '}
          <a href="mailto:security@keepcontracts.com">security@keepcontracts.com</a>.
        </p>
      </article>
    </main>
  );
}
