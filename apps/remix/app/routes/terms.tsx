import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { msg } from '@lingui/core/macro';
import { Link } from 'react-router';

import { BrandingLogo } from '~/components/general/branding-logo';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Terms of Service`);
}

export default function TermsPage() {
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
        <h1>Terms of Service</h1>
        <p>
          <strong>Effective date:</strong> [INSERT EFFECTIVE DATE]
        </p>

        <p>
          These Terms of Service ("Terms") govern your access to and use of Keep Contracts (the "Service"), operated by
          DataThink ("DataThink," "we," "us," or "our"). By creating an account or otherwise using the Service, you
          agree to these Terms. If you do not agree, do not use the Service.
        </p>

        <h2>1. The Service</h2>
        <p>
          Keep Contracts is a document preparation, electronic signature, and contract management platform. We may add,
          change, or remove features over time.
        </p>

        <h2>2. Accounts</h2>
        <ul>
          <li>You must provide accurate information when creating an account and keep it up to date.</li>
          <li>
            You are responsible for safeguarding your account credentials and for all activity under your account.
          </li>
          <li>
            You must be at least 18 years old, or the age of legal majority in your jurisdiction, to use the Service.
          </li>
        </ul>

        <h2>3. Acceptable Use</h2>
        <p>You agree not to use the Service to:</p>
        <ul>
          <li>Violate any applicable law or the rights of others;</li>
          <li>Upload content you do not have the right to share or that infringes another party's rights;</li>
          <li>Interfere with, disrupt, or attempt to gain unauthorized access to the Service or its systems.</li>
        </ul>

        <h2>4. Your Content and Documents</h2>
        <p>
          You retain all ownership rights in the documents, signatures, and other content you upload or create using the
          Service ("Your Content"). You grant DataThink a limited license to host, process, store, and transmit Your
          Content solely to provide the Service to you. You are solely responsible for the accuracy, legality, and
          appropriateness of Your Content.
        </p>

        <h2>5. Electronic Signatures</h2>
        <p>
          The Service allows you to collect and apply electronic signatures. You are responsible for determining whether
          an electronic signature is legally sufficient for your particular use case and jurisdiction.
        </p>

        <h2>6. Fees</h2>
        <p>
          Keep Contracts is not currently a paid product. If paid plans are introduced in the future, this section will
          be updated and you will be notified in advance of any charges.
        </p>

        <h2>7. Intellectual Property</h2>
        <p>
          Keep Contracts, DataThink, and associated names and logos are the property of DataThink. Nothing in these
          Terms grants you any right to use our trademarks or branding without prior written permission.
        </p>

        <h2>8. Termination</h2>
        <p>
          You may stop using the Service and request deletion of your account at any time. We may suspend or terminate
          accounts that violate these Terms.
        </p>

        <h2>9. Disclaimer of Warranties</h2>
        <p>
          The Service is provided "as is" and "as available," without warranties of any kind, to the fullest extent
          permitted by law.
        </p>

        <h2>10. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, DataThink will not be liable for any indirect, incidental, special, or
          consequential damages arising from your use of the Service.
        </p>

        <h2>11. Governing Law</h2>
        <p>
          These Terms are governed by the laws of [INSERT STATE/COUNTRY], without regard to its conflict of law
          principles. Any disputes arising from these Terms will be resolved in the courts located in [INSERT
          JURISDICTION/VENUE].
        </p>

        <h2>12. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. Continued use of the Service after changes take effect
          constitutes acceptance of the revised Terms.
        </p>

        <h2>13. Contact</h2>
        <p>Questions about these Terms can be sent to [INSERT CONTACT EMAIL].</p>
      </article>
    </main>
  );
}
