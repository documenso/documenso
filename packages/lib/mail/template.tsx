import * as React from 'react';

import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
  render,
} from '@react-email/components';

interface DocumensoEmailProps {
  email?: string;
  name?: string;
  firstName?: string;
  documentSigningLink?: string;
  documentName?: string;
  downloadLink?: string;
  reviewLink?: string;
  numberOfSigners?: number;
  type: 'invite' | 'signed' | 'completed';
}

export const DocumensoEmail = ({
  documentSigningLink = 'https://documenso.com',
  downloadLink = 'https://documenso.com',
  reviewLink = 'https://documenso.com',
  email = 'duncan@documenso.com',
  name = 'Ephraim Atta-Duncan',
  firstName = 'Ephraim',
  documentName = 'Open Source Pledge.pdf',
  numberOfSigners = 2,
  type = 'signed',
}: DocumensoEmailProps) => {
  const previewText = type === 'completed' ? 'Completed Document' : `Sign Document`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto ml-auto mr-auto font-sans">
          <Section className="bg-white">
            <Container
              style={{
                border: '2px solid #eaeaea',
              }}
              className="mx-auto mb-[10px] ml-auto mr-auto mt-[40px] w-[600px] rounded-lg p-[10px] backdrop-blur-sm"
            >
              <Section>
                <Img
                  src={`http://localhost:3000/static/logo.png`}
                  alt="Documenso Logo"
                  width={120}
                />

                <Section className="mt-4 flex-row items-center justify-center">
                  <div className="my-3 flex items-center justify-center">
                    <Img
                      className="ml-[160px]" // Works on most of the email clients
                      src={`http://localhost:3000/static/document.png`}
                      alt="Documenso"
                    />
                  </div>

                  {type === 'completed' && (
                    <Text className="mb-4 text-center text-[16px] font-semibold text-[#7AC455]">
                      <Img
                        src="http://localhost:3000/static/completed.png"
                        className="-mb-0.5 mr-1.5 inline"
                      />
                      Completed
                    </Text>
                  )}

                  {type === 'signed' && (
                    <Text className="mb-4 text-center text-[16px] font-semibold text-[#3879C5]">
                      <Img
                        src="http://localhost:3000/static/clock.png"
                        className="-mb-0.5 mr-1.5 inline"
                      />
                      Waiting for {numberOfSigners} {numberOfSigners === 1 ? 'person' : 'people'} to
                      sign
                    </Text>
                  )}

                  <Text className="mx-0 mb-0 text-center text-[16px] font-semibold text-[#27272A]">
                    {type === 'invite'
                      ? `${name} has invited you to sign “${documentName}”`
                      : `“${documentName}” was signed by ${name}`}
                  </Text>
                  <Text className="my-1 text-center text-[14px] text-[#AFAFAF]">
                    {type === 'invite'
                      ? 'Continue by signing the document.'
                      : 'Continue by downloading or reviewing the document.'}
                  </Text>
                  <Section className="mb-[24px] mt-[32px] text-center">
                    {type === 'invite' && (
                      <Button
                        pX={20}
                        pY={12}
                        className="rounded bg-[#A2E771] text-center text-[14px] font-medium text-black no-underline"
                        href={documentSigningLink}
                      >
                        Sign Document
                      </Button>
                    )}

                    {type !== 'invite' && (
                      <Section>
                        <Button
                          pX={18}
                          pY={10}
                          style={{
                            border: '1px solid #E9E9E9',
                          }}
                          className="mr-4 rounded-lg text-center text-[14px] font-medium text-black no-underline"
                          href={reviewLink}
                        >
                          <Img
                            src="http://localhost:3000/static/review.png"
                            className="-mb-0.5 mr-1 inline"
                          />
                          Review
                        </Button>
                        <Button
                          pX={18}
                          pY={10}
                          style={{
                            border: '1px solid #E9E9E9',
                          }}
                          className="rounded-lg text-center text-[14px] font-medium text-black no-underline"
                          href={downloadLink}
                        >
                          <Img
                            src="http://localhost:3000/static/download.png"
                            className="-mb-0.5 mr-1 inline"
                          />
                          Download
                        </Button>
                      </Section>
                    )}
                  </Section>
                </Section>
              </Section>
            </Container>
            <Container className="mx-auto ml-auto mr-auto w-[600px]">
              <Section>
                {type === 'invite' && (
                  <>
                    <Text className="text-[18px] leading-[24px] text-black">
                      {name} <span className="font-semibold text-[#AFAFAF]">({email})</span>
                    </Text>
                    <Text className="mb-[40px] text-[16px] leading-[28px] text-[#AFAFAF]">
                      Hi,
                      <br />
                      Please sign the attached document. Magna magna adipisicing dolore minim et
                      aliquip ipsum esse ut nulla ad sint irure.
                      <br /> - {firstName}
                    </Text>
                  </>
                )}

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

export const emailHtml = (props: DocumensoEmailProps) =>
  render(<DocumensoEmail {...props} />, {
    pretty: true,
  });

export const emailText = (props: DocumensoEmailProps) =>
  render(<DocumensoEmail {...props} />, {
    plainText: true,
  });
