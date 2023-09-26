import type { Locator, Page } from '@playwright/test';

export class DocumentsPage {
  private readonly fileInput: Locator;
  private readonly subject: Locator;
  private readonly message: Locator;

  // eslint-disable-next-line no-unused-vars
  constructor(public readonly page: Page) {
    this.fileInput = this.page.locator('input[type=file]');
    this.subject = this.page
      .locator('div')
      .filter({ hasText: /^Subject \(Optional\)$/ })
      .locator('input');
    this.message = this.page
      .locator('div')
      .filter({ hasText: /^Message \(Optional\)$/ })
      .locator('textarea');
  }

  async goToDocumentsPage() {
    await this.page.goto('/documents');
  }

  async uploadDocument(filePath: string) {
    await this.goToDocumentsPage();

    await this.fileInput.setInputFiles(filePath);
  }

  async addSigner(email: string, name: string) {
    await this.page.getByLabel('Email*').fill(email);
    await this.page.getByLabel('Name').fill(name);
    await this.page.getByRole('button', { name: 'Continue' }).click();
  }

  async addSignatureField(name: string) {
    await this.page
      .getByRole('button', { name: `${name} Signature` })
      .dragTo(this.page.locator('canvas'));
    await this.page.getByRole('button', { name: 'Continue' }).click();
  }

  async addSubjectAndMessage(subject: string, message: string) {
    await this.subject.fill(subject);
    await this.message.fill(message);
    await this.page.getByRole('button', { name: 'Send' }).click();
  }
}
