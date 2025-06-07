import { Trans } from '@lingui/react/macro';
import { Link } from 'react-router';

import { Button } from '@documenso/ui/primitives/button';

const SUPPORT_EMAIL = 'support@documenso.com';

export default function SignatureDisclosure() {
  return (
    <div>
      <article className="prose dark:prose-invert">
        <h1>
          <Trans>Electronic Signature Disclosure</Trans>
        </h1>

        <h2>
          <Trans>Welcome</Trans>
        </h2>
        <p>
          <Trans>
            Thank you for using Documenso to perform your electronic document signing. The purpose
            of this disclosure is to inform you about the process, legality, and your rights
            regarding the use of electronic signatures on our platform. By opting to use an
            electronic signature, you are agreeing to the terms and conditions outlined below.
          </Trans>
        </p>

        <h2>
          <Trans>Acceptance and Consent</Trans>
        </h2>
        <p>
          <Trans>
            When you use our platform to affix your electronic signature to documents, you are
            consenting to do so under the Electronic Signatures in Global and National Commerce Act
            (E-Sign Act) and other applicable laws. This action indicates your agreement to use
            electronic means to sign documents and receive notifications.
          </Trans>
        </p>

        <h2>
          <Trans>Legality of Electronic Signatures</Trans>
        </h2>
        <p>
          <Trans>
            An electronic signature provided by you on our platform, achieved through clicking
            through to a document and entering your name, or any other electronic signing method we
            provide, is legally binding. It carries the same weight and enforceability as a manual
            signature written with ink on paper.
          </Trans>
        </p>

        <h2>
          <Trans>System Requirements</Trans>
        </h2>
        <p>
          <Trans>To use our electronic signature service, you must have access to:</Trans>
        </p>
        <ul>
          <li>
            <Trans>A stable internet connection</Trans>
          </li>
          <li>
            <Trans>An email account</Trans>
          </li>
          <li>
            <Trans>A device capable of accessing, opening, and reading documents</Trans>
          </li>
          <li>
            <Trans>A means to print or download documents for your records</Trans>
          </li>
        </ul>

        <h2>
          <Trans>Electronic Delivery of Documents</Trans>
        </h2>
        <p>
          <Trans>
            All documents related to the electronic signing process will be provided to you
            electronically through our platform or via email. It is your responsibility to ensure
            that your email address is current and that you can receive and open our emails.
          </Trans>
        </p>

        <h2>
          <Trans>Consent to Electronic Transactions</Trans>
        </h2>
        <p>
          <Trans>
            By using the electronic signature feature, you are consenting to conduct transactions
            and receive disclosures electronically. You acknowledge that your electronic signature
            on documents is binding and that you accept the terms outlined in the documents you are
            signing.
          </Trans>
        </p>

        <h2>
          <Trans>Withdrawing Consent</Trans>
        </h2>
        <p>
          <Trans>
            You have the right to withdraw your consent to use electronic signatures at any time
            before completing the signing process. To withdraw your consent, please contact the
            sender of the document. In failing to contact the sender you may reach out to{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> for assistance. Be aware that
            withdrawing consent may delay or halt the completion of the related transaction or
            service.
          </Trans>
        </p>

        <h2>
          <Trans>Updating Your Information</Trans>
        </h2>
        <p>
          <Trans>
            It is crucial to keep your contact information, especially your email address, up to
            date with us. Please notify us immediately of any changes to ensure that you continue to
            receive all necessary communications.
          </Trans>
        </p>

        <h2>
          <Trans>Retention of Documents</Trans>
        </h2>
        <p>
          <Trans>
            After signing a document electronically, you will be provided the opportunity to view,
            download, and print the document for your records. It is highly recommended that you
            retain a copy of all electronically signed documents for your personal records. We will
            also retain a copy of the signed document for our records however we may not be able to
            provide you with a copy of the signed document after a certain period of time.
          </Trans>
        </p>

        <h2>
          <Trans>Acknowledgment</Trans>
        </h2>
        <p>
          <Trans>
            By proceeding to use the electronic signature service provided by Documenso, you affirm
            that you have read and understood this disclosure. You agree to all terms and conditions
            related to the use of electronic signatures and electronic transactions as outlined
            herein.
          </Trans>
        </p>

        <h2>
          <Trans>Contact Information</Trans>
        </h2>
        <p>
          <Trans>
            For any questions regarding this disclosure, electronic signatures, or any related
            process, please contact us at: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </Trans>
        </p>
      </article>

      <div className="mt-8">
        <Button asChild>
          <Link to="/">
            <Trans>Back home</Trans>
          </Link>
        </Button>
      </div>
    </div>
  );
}
