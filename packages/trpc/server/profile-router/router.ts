import { router } from '../trpc';
import { deleteAccountRoute } from './delete-account-route';
import { findUserSecurityAuditLogsRoute } from './find-user-security-audit-logs-route';
import { forgotPasswordRoute } from './forgot-password-route';
import { resetPasswordRoute } from './reset-password-route';
import { sendConfirmationEmailRoute } from './send-confirmation-email-route';
import { setProfileImageRoute } from './set-profile-image-route';
import { updatePasswordRoute } from './update-password-route';
import { updateProfileRoute } from './update-profile-route';
import { updatePublicProfileRoute } from './update-public-profile-route';

export const profileRouter = router({
  findUserSecurityAuditLogs: findUserSecurityAuditLogsRoute,
  updateProfile: updateProfileRoute,
  updatePublicProfile: updatePublicProfileRoute,
  updatePassword: updatePasswordRoute,
  forgotPassword: forgotPasswordRoute,
  resetPassword: resetPasswordRoute,
  sendConfirmationEmail: sendConfirmationEmailRoute,
  deleteAccount: deleteAccountRoute,
  setProfileImage: setProfileImageRoute,
});
