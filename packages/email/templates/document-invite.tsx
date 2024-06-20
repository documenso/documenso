import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';
import type { RecipientRole } from '@documenso/prisma/client';
import config from '@documenso/tailwind-config';

import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from '../components';
import type { TemplateDocumentInviteProps } from '../template-components/template-document-invite';
import { TemplateDocumentInvite } from '../template-components/template-document-invite';
import { TemplateFooter } from '../template-components/template-footer';

export type DocumentInviteEmailTemplateProps = Partial<TemplateDocumentInviteProps> & {
  customBody?: string;
  role: RecipientRole;
  selfSigner?: boolean;
};

export const DocumentInviteEmailTemplate = ({
  inviterName = 'გიორგი ჩიქოვანი',
  inviterEmail = 'giorgi@documenso.com',
  documentName = 'Open Source Pledge.pdf',
  signDocumentLink = 'https://documenso.com',
  assetBaseUrl = 'http://localhost:3002',
  customBody,
  role,
  selfSigner = false,
}: DocumentInviteEmailTemplateProps) => {
  const action = RECIPIENT_ROLES_DESCRIPTION[role].actionVerb.toLowerCase();

  // const previewText = selfSigner
  // ? `please ${action} your document ${documentName}`
  // : `${inviterName} has invited you to ${action} ${documentName}`;

  // const previewText = selfSigner
  //   ? `გთხოვთ
  //   ${action === 'ასლი მიიღოთ' && 'თქვენი დოკუმენტის'}
  //   ${action}
  //   ${action === 'დაამტკიცოთ' && 'თქვენი დოკუმენტი'}
  //   ${action === 'ხელი მოაწეროთ' && 'თქვენს დოკუმენტს'}
  //   ${action === 'იხილოთ' && 'თქვენი დოკუმენტი'}
  //   "${documentName}"`
  //   : `${inviterName}: მოგიწვიათ, რათა
  //    ${action === 'ასლი მიიღოთ' && 'დოკუმენტის'}
  //    ${action}
  //    ${action === 'ხელი მოაწეროთ' ? 'დოკუმენტს' : action === 'ასლი მიიღოთ' ? '' : 'დოკუმენტი'}
  //     "${documentName}"`;

  const previewText = selfSigner
    ? `გთხოვთ 
    ${action === 'ასლი მიიღოთ' ? 'თქვენი დოკუმენტის' : ''}
    ${action} 
    ${action === 'დაამტკიცოთ' ? 'თქვენი დოკუმენტი' : ''}
    ${action === 'ხელი მოაწეროთ' ? 'თქვენს დოკუმენტს' : ''}
    ${action === 'იხილოთ' ? 'თქვენი დოკუმენტი' : ''}
    "${documentName}"`
    : `${inviterName}: მოგიწვიათ, რათა 
     ${action === 'ასლი მიიღოთ' ? 'დოკუმენტის' : ''} 
     ${action} 
     ${action === 'ხელი მოაწეროთ' ? 'დოკუმენტს' : action === 'ასლი მიიღოთ' ? '' : 'დოკუმენტი'}
      "${documentName}"`;

  const getAssetUrl = (path: string) => {
    return new URL(path, assetBaseUrl).toString();
  };

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: config.theme.extend.colors,
            },
          },
        }}
      >
        <Body className="mx-auto my-auto bg-white font-sans">
          <Section>
            <Container className="mx-auto mb-2 mt-8 max-w-xl rounded-lg border border-solid border-slate-200 p-4 backdrop-blur-sm">
              <Section>
                <Img
                  src={getAssetUrl('/static/IPOGRAFI.svg')}
                  alt="Ipografi Logo"
                  className="mb-4 w-40"
                  // className="mb-4 h-6"
                />

                <TemplateDocumentInvite
                  inviterName={inviterName}
                  inviterEmail={inviterEmail}
                  documentName={documentName}
                  signDocumentLink={signDocumentLink}
                  assetBaseUrl={assetBaseUrl}
                  role={role}
                  selfSigner={selfSigner}
                />
              </Section>
            </Container>

            <Container className="mx-auto mt-12 max-w-xl">
              <Section>
                <Text className="my-4 text-base font-semibold">
                  {inviterName}{' '}
                  <Link className="font-normal text-slate-400" href="mailto:{inviterEmail}">
                    ({inviterEmail})
                  </Link>
                </Text>

                <Text className="mt-2 text-base text-slate-400">
                  {customBody ? (
                    <pre className="font-sans text-base text-slate-400">{customBody}</pre>
                  ) : (
                    `${inviterName}: მოგიწვიათ, რათა 
                     ${action === 'ასლი მიიღოთ' && 'დოკუმენტის'} 
                     ${action} 
                     ${
                       action === 'ხელი მოაწეროთ'
                         ? 'დოკუმენტს'
                         : action === 'ასლი მიიღოთ'
                         ? ''
                         : 'დოკუმენტი'
                     }
                     "${documentName}"`
                  )}
                </Text>
              </Section>
            </Container>

            <Hr className="mx-auto mt-12 max-w-xl" />

            <Container className="mx-auto max-w-xl">
              <TemplateFooter />
            </Container>
          </Section>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default DocumentInviteEmailTemplate;
