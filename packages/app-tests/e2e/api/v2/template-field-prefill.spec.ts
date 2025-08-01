import { expect, test } from '@playwright/test';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import type { TCheckboxFieldMeta, TRadioFieldMeta } from '@documenso/lib/types/field-meta';
import { prisma } from '@documenso/prisma';
import { FieldType, RecipientRole } from '@documenso/prisma/client';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe('Template Field Prefill API v2', () => {
  test('should create a document from template with prefilled fields', async ({
    page,
    request,
  }) => {
    // 1. Create a user
    const { user, team } = await seedUser();

    // 2. Create an API token for the user
    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test-token',
      expiresIn: null,
    });

    // 3. Create a template with seedBlankTemplate
    const template = await seedBlankTemplate(user, team.id, {
      createTemplateOptions: {
        title: 'Template with Advanced Fields V2',
      },
    });

    // 4. Create a recipient for the template
    const recipient = await prisma.recipient.create({
      data: {
        templateId: template.id,
        email: 'recipient@example.com',
        name: 'Test Recipient',
        role: RecipientRole.SIGNER,
        token: 'test-token',
        readStatus: 'NOT_OPENED',
        sendStatus: 'NOT_SENT',
        signingStatus: 'NOT_SIGNED',
      },
    });

    // 5. Add fields to the template
    // Add TEXT field
    const textField = await prisma.field.create({
      data: {
        templateId: template.id,
        recipientId: recipient.id,
        type: FieldType.TEXT,
        page: 1,
        positionX: 5,
        positionY: 5,
        width: 20,
        height: 5,
        customText: '',
        inserted: false,
        fieldMeta: {
          type: 'text',
          label: 'Text Field',
        },
      },
    });

    // Add NUMBER field
    const numberField = await prisma.field.create({
      data: {
        templateId: template.id,
        recipientId: recipient.id,
        type: FieldType.NUMBER,
        page: 1,
        positionX: 5,
        positionY: 15,
        width: 20,
        height: 5,
        customText: '',
        inserted: false,
        fieldMeta: {
          type: 'number',
          label: 'Number Field',
        },
      },
    });

    // Add RADIO field
    const radioField = await prisma.field.create({
      data: {
        templateId: template.id,
        recipientId: recipient.id,
        type: FieldType.RADIO,
        page: 1,
        positionX: 5,
        positionY: 25,
        width: 20,
        height: 5,
        customText: '',
        inserted: false,
        fieldMeta: {
          type: 'radio',
          label: 'Radio Field',
          values: [
            { id: 1, value: 'Option A', checked: false },
            { id: 2, value: 'Option B', checked: false },
          ],
        },
      },
    });

    // Add CHECKBOX field
    const checkboxField = await prisma.field.create({
      data: {
        templateId: template.id,
        recipientId: recipient.id,
        type: FieldType.CHECKBOX,
        page: 1,
        positionX: 5,
        positionY: 35,
        width: 20,
        height: 5,
        customText: '',
        inserted: false,
        fieldMeta: {
          type: 'checkbox',
          label: 'Checkbox Field',
          values: [
            { id: 1, value: 'Check A', checked: false },
            { id: 2, value: 'Check B', checked: false },
          ],
        },
      },
    });

    // Add DROPDOWN field
    const dropdownField = await prisma.field.create({
      data: {
        templateId: template.id,
        recipientId: recipient.id,
        type: FieldType.DROPDOWN,
        page: 1,
        positionX: 5,
        positionY: 45,
        width: 20,
        height: 5,
        customText: '',
        inserted: false,
        fieldMeta: {
          type: 'dropdown',
          label: 'Dropdown Field',
          values: [{ value: 'Select A' }, { value: 'Select B' }],
        },
      },
    });

    // 6. Sign in as the user
    await apiSignin({
      page,
      email: user.email,
    });

    // 7. Navigate to the template
    await page.goto(`${WEBAPP_BASE_URL}/templates/${template.id}`);

    // 8. Create a document from the template with prefilled fields using v2 API
    const response = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/use`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        templateId: template.id,
        recipients: [
          {
            id: recipient.id,
            email: 'recipient@example.com',
            name: 'Test Recipient',
          },
        ],
        prefillFields: [
          {
            id: textField.id,
            type: 'text',
            label: 'Prefilled Text',
            value: 'This is prefilled text',
          },
          {
            id: numberField.id,
            type: 'number',
            label: 'Prefilled Number',
            value: '98765',
          },
          {
            id: radioField.id,
            type: 'radio',
            label: 'Prefilled Radio',
            value: 'Option A',
          },
          {
            id: checkboxField.id,
            type: 'checkbox',
            label: 'Prefilled Checkbox',
            value: ['Check A', 'Check B'],
          },
          {
            id: dropdownField.id,
            type: 'dropdown',
            label: 'Prefilled Dropdown',
            value: 'Select B',
          },
        ],
      },
    });

    const responseData = await response.json();

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    expect(responseData.id).toBeDefined();

    // 9. Verify the document was created with prefilled fields
    const document = await prisma.document.findUnique({
      where: {
        id: responseData.id,
      },
      include: {
        fields: true,
      },
    });

    expect(document).not.toBeNull();

    // 10. Verify each field has the correct prefilled values
    const documentTextField = document?.fields.find(
      (field) => field.type === FieldType.TEXT && field.fieldMeta?.type === 'text',
    );
    expect(documentTextField?.fieldMeta).toMatchObject({
      type: 'text',
      label: 'Prefilled Text',
      text: 'This is prefilled text',
    });

    const documentNumberField = document?.fields.find(
      (field) => field.type === FieldType.NUMBER && field.fieldMeta?.type === 'number',
    );
    expect(documentNumberField?.fieldMeta).toMatchObject({
      type: 'number',
      label: 'Prefilled Number',
      value: '98765',
    });

    const documentRadioField = document?.fields.find(
      (field) => field.type === FieldType.RADIO && field.fieldMeta?.type === 'radio',
    );
    expect(documentRadioField?.fieldMeta).toMatchObject({
      type: 'radio',
      label: 'Prefilled Radio',
    });
    // Check that the correct radio option is selected
    const radioValues = (documentRadioField?.fieldMeta as TRadioFieldMeta)?.values || [];
    const selectedRadioOption = radioValues.find((option) => option.checked);
    expect(selectedRadioOption?.value).toBe('Option A');

    const documentCheckboxField = document?.fields.find(
      (field) => field.type === FieldType.CHECKBOX && field.fieldMeta?.type === 'checkbox',
    );
    expect(documentCheckboxField?.fieldMeta).toMatchObject({
      type: 'checkbox',
      label: 'Prefilled Checkbox',
    });
    // Check that the correct checkbox options are selected
    const checkboxValues = (documentCheckboxField?.fieldMeta as TCheckboxFieldMeta)?.values || [];
    const checkedOptions = checkboxValues.filter((option) => option.checked);
    expect(checkedOptions.length).toBe(2);
    expect(checkedOptions.map((option) => option.value)).toContain('Check A');
    expect(checkedOptions.map((option) => option.value)).toContain('Check B');

    const documentDropdownField = document?.fields.find(
      (field) => field.type === FieldType.DROPDOWN && field.fieldMeta?.type === 'dropdown',
    );
    expect(documentDropdownField?.fieldMeta).toMatchObject({
      type: 'dropdown',
      label: 'Prefilled Dropdown',
      defaultValue: 'Select B',
    });

    const sendResponse = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/distribute`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        documentId: document?.id,
        meta: {
          subject: 'Test Subject',
          message: 'Test Message',
        },
      },
    });

    await expect(sendResponse.ok()).toBeTruthy();
    await expect(sendResponse.status()).toBe(200);

    // 11. Sign in as the recipient and verify the prefilled fields are visible
    const documentRecipient = await prisma.recipient.findFirst({
      where: {
        documentId: document?.id,
        email: 'recipient@example.com',
      },
    });

    expect(documentRecipient).not.toBeNull();

    // Visit the signing page
    await page.goto(`${WEBAPP_BASE_URL}/sign/${documentRecipient?.token}`);

    // Verify the prefilled fields are visible with correct values
    // Text field
    await expect(page.getByText('This is prefilled')).toBeVisible();

    // Number field
    await expect(page.getByText('98765', { exact: true })).toBeVisible();

    // Radio field
    await expect(page.getByText('Option A')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Option A' })).toBeChecked();

    // Checkbox field
    await expect(page.getByText('Check A')).toBeVisible();
    await expect(page.getByText('Check B')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Check A' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Check B' })).toBeChecked();

    // Dropdown field
    await expect(page.getByText('Select B')).toBeVisible();
  });

  test('should create a document from template without prefilled fields', async ({
    page,
    request,
  }) => {
    // 1. Create a user
    const { user, team } = await seedUser();

    // 2. Create an API token for the user
    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test-token',
      expiresIn: null,
    });

    // 3. Create a template with seedBlankTemplate
    const template = await seedBlankTemplate(user, team.id, {
      createTemplateOptions: {
        title: 'Template with Default Fields V2',
      },
    });

    // 4. Create a recipient for the template
    const recipient = await prisma.recipient.create({
      data: {
        templateId: template.id,
        email: 'recipient@example.com',
        name: 'Test Recipient',
        role: RecipientRole.SIGNER,
        token: 'test-token',
        readStatus: 'NOT_OPENED',
        sendStatus: 'NOT_SENT',
        signingStatus: 'NOT_SIGNED',
      },
    });

    // 5. Add fields to the template
    // Add TEXT field
    await prisma.field.create({
      data: {
        templateId: template.id,
        recipientId: recipient.id,
        type: FieldType.TEXT,
        page: 1,
        positionX: 5,
        positionY: 5,
        width: 20,
        height: 5,
        customText: '',
        inserted: false,
        fieldMeta: {
          type: 'text',
          label: 'Default Text Field',
        },
      },
    });

    // Add NUMBER field
    await prisma.field.create({
      data: {
        templateId: template.id,
        recipientId: recipient.id,
        type: FieldType.NUMBER,
        page: 1,
        positionX: 5,
        positionY: 15,
        width: 20,
        height: 5,
        customText: '',
        inserted: false,
        fieldMeta: {
          type: 'number',
          label: 'Default Number Field',
        },
      },
    });

    // 6. Sign in as the user
    await apiSignin({
      page,
      email: user.email,
    });

    // 7. Navigate to the template
    await page.goto(`${WEBAPP_BASE_URL}/templates/${template.id}`);

    // 8. Create a document from the template without prefilled fields using v2 API
    const response = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/use`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        templateId: template.id,
        recipients: [
          {
            id: recipient.id,
            email: 'recipient@example.com',
            name: 'Test Recipient',
          },
        ],
      },
    });

    const responseData = await response.json();

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    expect(responseData.id).toBeDefined();

    // 9. Verify the document was created with default fields
    const document = await prisma.document.findUnique({
      where: {
        id: responseData.id,
      },
      include: {
        fields: true,
      },
    });

    expect(document).not.toBeNull();

    // 10. Verify fields have their default values
    const documentTextField = document?.fields.find((field) => field.type === FieldType.TEXT);
    expect(documentTextField?.fieldMeta).toMatchObject({
      type: 'text',
      label: 'Default Text Field',
    });

    const documentNumberField = document?.fields.find((field) => field.type === FieldType.NUMBER);
    expect(documentNumberField?.fieldMeta).toMatchObject({
      type: 'number',
      label: 'Default Number Field',
    });

    const sendResponse = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/distribute`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        documentId: document?.id,
        meta: {
          subject: 'Test Subject',
          message: 'Test Message',
        },
      },
    });

    await expect(sendResponse.ok()).toBeTruthy();
    await expect(sendResponse.status()).toBe(200);

    // 11. Sign in as the recipient and verify the default fields are visible
    const documentRecipient = await prisma.recipient.findFirst({
      where: {
        documentId: document?.id,
        email: 'recipient@example.com',
      },
    });

    expect(documentRecipient).not.toBeNull();

    // Visit the signing page
    await page.goto(`${WEBAPP_BASE_URL}/sign/${documentRecipient?.token}`);

    await expect(page.getByText('This is prefilled')).not.toBeVisible();
  });

  test('should handle invalid field prefill values', async ({ request }) => {
    // 1. Create a user
    const { user, team } = await seedUser();

    // 2. Create an API token for the user
    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'test-token',
      expiresIn: null,
    });

    // 3. Create a template using seedBlankTemplate
    const template = await seedBlankTemplate(user, team.id, {
      createTemplateOptions: {
        title: 'Template for Invalid Test V2',
        visibility: 'EVERYONE',
      },
    });

    // 4. Create a recipient for the template
    const recipient = await prisma.recipient.create({
      data: {
        templateId: template.id,
        email: 'recipient@example.com',
        name: 'Test Recipient',
        role: RecipientRole.SIGNER,
        token: 'test-token',
        readStatus: 'NOT_OPENED',
        sendStatus: 'NOT_SENT',
        signingStatus: 'NOT_SIGNED',
      },
    });

    // 5. Add a field to the template
    const field = await prisma.field.create({
      data: {
        templateId: template.id,
        recipientId: recipient.id,
        type: FieldType.RADIO,
        page: 1,
        positionX: 100,
        positionY: 100,
        width: 100,
        height: 50,
        customText: '',
        inserted: false,
        fieldMeta: {
          type: 'radio',
          label: 'Radio Field',
          values: [
            { id: 1, value: 'Option A', checked: false },
            { id: 2, value: 'Option B', checked: false },
          ],
        },
      },
    });

    // 7. Try to create a document with invalid prefill value
    const response = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/template/use`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        templateId: template.id,
        recipients: [
          {
            id: recipient.id,
            email: 'recipient@example.com',
            name: 'Test Recipient',
          },
        ],
        prefillFields: [
          {
            id: field.id,
            type: 'radio',
            label: 'Invalid Radio',
            value: 'Non-existent Option', // This option doesn't exist
          },
        ],
      },
    });

    // 8. Verify the request fails with appropriate error
    expect(response.ok()).toBeFalsy();
    expect(response.status()).toBe(400);

    const errorData = await response.json();
    expect(errorData.message).toContain('not found in options for RADIO field');
  });
});
