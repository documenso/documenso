import { adminRouter } from './admin-router/router';
import { apiTokenRouter } from './api-token-router/router';
import { authRouter } from './auth-router/router';
import { billingRouter } from './billing/router';
import { documentRouter } from './document-router/router';
import { embeddingPresignRouter } from './embedding-router/_router';
import { fieldRouter } from './field-router/router';
import { folderRouter } from './folder-router/router';
import { organisationRouter } from './organisation-router/router';
import { profileRouter } from './profile-router/router';
import { recipientRouter } from './recipient-router/router';
import { shareLinkRouter } from './share-link-router/router';
import { teamRouter } from './team-router/router';
import { templateRouter } from './template-router/router';
import { router } from './trpc';
import { webhookRouter } from './webhook-router/router';

export const appRouter = router({
  auth: authRouter,
  billing: billingRouter,
  profile: profileRouter,
  document: documentRouter,
  field: fieldRouter,
  folder: folderRouter,
  recipient: recipientRouter,
  admin: adminRouter,
  organisation: organisationRouter,
  shareLink: shareLinkRouter,
  apiToken: apiTokenRouter,
  team: teamRouter,
  template: templateRouter,
  webhook: webhookRouter,
  embeddingPresign: embeddingPresignRouter,
});

export type AppRouter = typeof appRouter;
