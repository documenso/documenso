import * as React from 'react';

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
  render,
} from '@react-email/components';

interface DocumensoSigningInviteEmailProps {
  username?: string;
  userImage?: string;
  invitedByUsername?: string;
  invitedByEmail?: string;
  teamName?: string;
  teamImage?: string;
  signingLink?: string;
  inviteFromIp?: string;
  inviteFromLocation?: string;
}

export const DocumensoSigningInviteEmail = ({
  signingLink = 'https://documenso.com',
}: DocumensoSigningInviteEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Sign Document</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto font-sans">
          <Section className="bg-white">
            <Container className="mx-auto mb-[10px] mt-[40px] w-[600px] rounded-lg border-2 border-solid border-[#eaeaea] p-[20px] backdrop-blur-sm">
              <Section>
                <Section>
                  <Img
                    src={`http://localhost:3000/static/logo.png`}
                    alt="Documenso Logo"
                    width={120}
                  />
                </Section>

                <Section className="mt-4 flex items-center justify-center">
                  <Section className="flex justify-center">
                    <Img src={`http://localhost:3000/static/document.png`} alt="Documenso" />
                  </Section>

                  <Heading className="mx-0 mb-0 text-center text-[18px] font-semibold text-[#27272A]">
                    Thilo Konzok has invited you to sign “Document.pdf”
                  </Heading>
                  <Text className="my-1 text-center text-[16px] text-[#AFAFAF]">
                    Continue by signing the document.
                  </Text>
                  <Section className="mb-[24px] mt-[32px] text-center">
                    <Button
                      pX={20}
                      pY={12}
                      className="rounded bg-[#A2E771] px-10 text-center text-[14px] font-medium text-black no-underline"
                      href={signingLink}
                    >
                      Sign Document
                    </Button>
                  </Section>
                </Section>
              </Section>
            </Container>
            <Container className="mx-auto w-[600px]">
              <Section>
                <Text className="text-[18px] leading-[24px] text-black">
                  Thilo Konzok{' '}
                  <span className="font-semibold text-[#AFAFAF]">(thilo@konzok.com)</span>
                </Text>
                <Text className="mb-[80px] text-[16px] leading-[28px] text-[#AFAFAF]">
                  Hi,
                  <br />
                  Please sign the attached document. Magna magna adipisicing dolore minim et aliquip
                  ipsum esse ut nulla ad sint irure.
                  <br /> - Thilo
                </Text>

                <Text className="my-[40px] text-[14px] text-[#AFAFAF]">
                  This document was sent using{' '}
                  <Link className="text-[#7AC455] underline" href="https://documenso.com">
                    Documenso.
                  </Link>
                </Text>

                <Text className="my-[40px] text-[14px] text-[#AFAFAF]">
                  Documenso
                  <br />
                  2261 Market Street, #5211, San Francisco, CA 94114, USA
                </Text>
              </Section>
            </Container>
          </Section>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default DocumensoSigningInviteEmail;

export const emailHtml = render(<DocumensoSigningInviteEmail />);
export const emailText = render(<DocumensoSigningInviteEmail />, {
  plainText: true,
});
