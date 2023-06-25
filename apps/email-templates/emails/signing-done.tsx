import * as React from "react";
import { BaseLayout } from "../components";
import { Container, Hr, Link, Section } from "@react-email/components";

interface Props {
  message: string;
  publicUrl: string;
}

export const SigningDoneEmail = (props: Props) => {
  const {
    message = "All recipients have signed 'example document' ",
    publicUrl = "http://localhost:3000",
  } = props;
  return (
    <BaseLayout publicUrl={publicUrl} message={message}>
      <Container className="pb-14 text-center">
        <img
          src={`${publicUrl}/images/signed_100.png`}
          className="h-24 w-24"
          alt="Documenso Logo"
        />

        <Section className="text-center text-[#bdc1c6]">
          A copy of the signed document has been attached to this email.
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

export default SigningDoneEmail;
