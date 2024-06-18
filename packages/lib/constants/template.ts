export const TEMPLATE_RECIPIENT_EMAIL_PLACEHOLDER_REGEX = /recipient\.\d+@documenso\.com/i;
export const TEMPLATE_RECIPIENT_NAME_PLACEHOLDER_REGEX = /Recipient \d+/i;

export const DIRECT_TEMPLATE_DOCUMENTATION = [
  {
    title: 'Enable Direct Link Signing',
    description:
      'Once enabled, you can select any active recipient to be a direct link signing recipient, or create a new one. This recipient type cannot be edited or deleted.',
  },
  {
    title: 'Configure Direct Recipient',
    description:
      'Update the role and add fields as required for the direct recipient. The individual who uses the direct link will sign the document as the direct recipient.',
  },
  {
    title: 'Share the Link',
    description:
      'Once your template is set up, share the link anywhere you want. The person who opens the link will be able to enter their information in the direct link recipient field and complete any other fields assigned to them.',
  },
  {
    title: 'Document Creation',
    description:
      'After submission, a document will be automatically generated and added to your documents page. You will also receive a notification via email.',
  },
];

export const DIRECT_TEMPLATE_RECIPIENT_EMAIL = 'direct.link@documenso.com';
export const DIRECT_TEMPLATE_RECIPIENT_NAME = 'Direct link recipient';
