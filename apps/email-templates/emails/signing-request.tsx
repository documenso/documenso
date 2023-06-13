import * as React from "react";
import { BaseLayout } from "../components";
import { Button, Container, Hr, Link, Section, Text } from "@react-email/components";

interface Props {
  ctaLink: string;
  ctaLabel: string;
  title: string;
  userName: string;
  message: string;
  publicUrl: string;
}

export const SigningRequestEmail = (props: Props) => {
  const {
    ctaLink = "https://www.example.com",
    ctaLabel = "Sign Document",
    title = "invoice-EC430263-0004.pdf",
    userName = "john doe",
    message = "example@documenso.com has sent you a document to sign. ",
    publicUrl = "http://localhost:3000",
  } = props;
  return (
    <BaseLayout publicUrl={publicUrl} message={message}>
      <Container className="pb-14 text-center">
        <Section className="text-center text-[#bdc1c6]">
          <Button
            pX={18}
            pY={10}
            className="rounded-md bg-[#37f095] text-center text-lg font-semibold text-white no-underline"
            href={ctaLink}>
            {ctaLabel}
          </Button>
          <Hr className="mt-4 border-[#e0e0e0]" />
          Click the button to view "{title}".
          <br />
          <small>If you have questions about this document, you should ask {userName}.</small>
          <Hr className="border-[#e0e0e0]" />
          <small>
            Want to send you own signing links?{" "}
            <Link href="https://documenso.com">Hosted Documenso is here!</Link>.
          </small>
        </Section>
      </Container>
    </BaseLayout>
  );
};

export default SigningRequestEmail;
