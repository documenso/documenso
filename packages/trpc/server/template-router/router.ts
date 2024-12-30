import { router } from '../trpc';
import { createDocumentFromTemplateRoute } from './create-document-from-template-route';
import { createTemplateDirectLinkRoute } from './create-template-direct-link-route';
import { createTemplateRoute } from './create-template-route';
import { deleteTemplateDirectLinkRoute } from './delete-template-direct-link-route';
import { deleteTemplateRoute } from './delete-template-route';
import { duplicateTemplateRoute } from './duplicate-template-route';
import { findTemplatesRoute } from './find-templates-route';
import { getTemplateRoute } from './get-template-route';
import { moveTemplateToTeamRoute } from './move-template-to-team-route';
import { setSigningOrderForTemplateRoute } from './set-signing-order-for-template-route';
import { toggleTemplateDirectLinkRoute } from './toggle-template-direct-link-route';
import { updateTemplateRoute } from './update-template-route';
import { updateTemplateTypedSignatureSettingsRoute } from './update-template-typed-signature-settings-route';

export const templateRouter = router({
  /**
   * Public endpoints.
   */
  findTemplates: findTemplatesRoute,
  getTemplateById: getTemplateRoute,
  createTemplate: createTemplateRoute,
  updateTemplate: updateTemplateRoute,
  duplicateTemplate: duplicateTemplateRoute,
  deleteTemplate: deleteTemplateRoute,
  createDocumentFromTemplate: createDocumentFromTemplateRoute,
  createDocumentFromDirectTemplate: createDocumentFromTemplateRoute,
  createTemplateDirectLink: createTemplateDirectLinkRoute,
  deleteTemplateDirectLink: deleteTemplateDirectLinkRoute,
  toggleTemplateDirectLink: toggleTemplateDirectLinkRoute,
  moveTemplateToTeam: moveTemplateToTeamRoute,

  /**
   * Private endpoints.
   */
  setSigningOrderForTemplate: setSigningOrderForTemplateRoute,
  updateTemplateTypedSignatureSettings: updateTemplateTypedSignatureSettingsRoute,
});
