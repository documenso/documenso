import Link from 'next/link';

import { Button } from '@documenso/ui/primitives/button';

export default function SignatureDisclosure() {
  return (
    <div>
      <article className="prose dark:prose-invert">
        <h1>Electronic Signature Disclosure</h1>

        <h2>Welcome</h2>
        <p>
          Thank you for using Documenso to perform your electronic document signing. The purpose of
          this disclosure is to inform you about the process, legality, and your rights regarding
          the use of electronic signatures on our platform. By opting to use an electronic
          signature, you are agreeing to the terms and conditions outlined below.
        </p>

        <h2>Acceptance and Consent</h2>
        <p>
          When you use our platform to affix your electronic signature to documents, you are
          consenting to do so under the Electronic Signatures in Global and National Commerce Act
          (E-Sign Act) and other applicable laws. This action indicates your agreement to use
          electronic means to sign documents and receive notifications.
        </p>

        <h2>Legality of Electronic Signatures</h2>
        <p>
          An electronic signature provided by you on our platform, achieved through clicking through
          to a document and entering your name, or any other electronic signing method we provide,
          is legally binding. It carries the same weight and enforceability as a manual signature
          written with ink on paper.
        </p>

        <h2>System Requirements</h2>
        <p>To use our electronic signature service, you must have access to:</p>
        <ul>
          <li>A stable internet connection</li>
          <li>An email account</li>
          <li>A device capable of accessing, opening, and reading documents</li>
          <li>A means to print or download documents for your records</li>
        </ul>

        <h2>Electronic Delivery of Documents</h2>
        <p>
          All documents related to the electronic signing process will be provided to you
          electronically through our platform or via email. It is your responsibility to ensure that
          your email address is current and that you can receive and open our emails.
        </p>

        <h2>Consent to Electronic Transactions</h2>
        <p>
          By using the electronic signature feature, you are consenting to conduct transactions and
          receive disclosures electronically. You acknowledge that your electronic signature on
          documents is binding and that you accept the terms outlined in the documents you are
          signing.
        </p>

        <h2>Withdrawing Consent</h2>
        <p>
          You have the right to withdraw your consent to use electronic signatures at any time
          before completing the signing process. To withdraw your consent, please contact the sender
          of the document. In failing to contact the sender you may reach out to{' '}
          <a href="mailto:support@documenso.com">support@documenso.com</a> for assistance. Be aware
          that withdrawing consent may delay or halt the completion of the related transaction or
          service.
        </p>

        <h2>Updating Your Information</h2>
        <p>
          It is crucial to keep your contact information, especially your email address, up to date
          with us. Please notify us immediately of any changes to ensure that you continue to
          receive all necessary communications.
        </p>

        <h2>Retention of Documents</h2>
        <p>
          After signing a document electronically, you will be provided the opportunity to view,
          download, and print the document for your records. It is highly recommended that you
          retain a copy of all electronically signed documents for your personal records. We will
          also retain a copy of the signed document for our records however we may not be able to
          provide you with a copy of the signed document after a certain period of time.
        </p>

        <h2>Acknowledgment</h2>
        <p>
          By proceeding to use the electronic signature service provided by Documenso, you affirm
          that you have read and understood this disclosure. You agree to all terms and conditions
          related to the use of electronic signatures and electronic transactions as outlined
          herein.
        </p>

        <h2>Contact Information</h2>
        <p>
          For any questions regarding this disclosure, electronic signatures, or any related
          process, please contact us at:{' '}
          <a href="mailto:support@documenso.com">support@documenso.com</a>
        </p>
      </article>

      <div className="mt-8">
        <Button asChild>
          <Link href="/documents">Back to Documents</Link>
        </Button>
      </div>
    </div>
  );
}
