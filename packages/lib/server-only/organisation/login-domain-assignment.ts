import { prisma } from '@documenso/prisma';

import { extractAndNormalizeDomain } from '../../utils/domain';
import { logger } from '../../utils/logger';
import { autoAssignUserToOrganisations } from './domain-organisation';

// Cache to prevent repeated checks within the same session
const loginAssignmentCache = new Map<string, Date>();
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Clean expired cache entries
 */
const cleanExpiredCacheEntries = () => {
  const now = new Date();
  const keysToDelete: string[] = [];

  for (const [key, timestamp] of loginAssignmentCache.entries()) {
    if (now.getTime() - timestamp.getTime() > CACHE_DURATION_MS) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => loginAssignmentCache.delete(key));
};

/**
 * Check if user needs domain-based auto-assignment check during login
 * Uses efficient timestamp comparison to avoid unnecessary processing
 */
export const shouldCheckDomainAssignment = async (
  userId: number,
  userEmail: string,
): Promise<boolean> => {
  try {
    // Clean expired cache entries periodically
    if (loginAssignmentCache.size > 100) {
      cleanExpiredCacheEntries();
    }

    const cacheKey = `${userId}-${userEmail}`;
    const cachedCheck = loginAssignmentCache.get(cacheKey);

    // If we've checked recently, skip
    if (cachedCheck && Date.now() - cachedCheck.getTime() < CACHE_DURATION_MS) {
      return false;
    }

    const userDomain = extractAndNormalizeDomain(userEmail);
    if (!userDomain) {
      return false;
    }

    // Get user's last login time (from security audit log)
    const lastLoginAudit = await prisma.userSecurityAuditLog.findFirst({
      where: {
        userId,
        type: 'SIGN_IN',
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        createdAt: true,
      },
    });

    // For first-time login, we don't need to check since new users
    // are already handled by the email verification flow
    if (!lastLoginAudit) {
      loginAssignmentCache.set(cacheKey, new Date());
      return false;
    }

    // Check if any domain configurations were added after user's last login
    const newDomainConfigurations = await prisma.organisationDomainAccess.findFirst({
      where: {
        domain: userDomain,
        createdAt: {
          gt: lastLoginAudit.createdAt,
        },
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    const shouldCheck = !!newDomainConfigurations;

    // Cache the result
    loginAssignmentCache.set(cacheKey, new Date());

    if (shouldCheck) {
      logger.info('Login-time domain assignment check needed', {
        userId,
        userDomain,
        lastLogin: lastLoginAudit.createdAt,
        newDomainConfiguredAt: newDomainConfigurations?.createdAt,
      });
    }

    return shouldCheck;
  } catch (error) {
    logger.error('Error checking if domain assignment needed', {
      userId,
      userEmail,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
};

/**
 * Perform domain-based auto-assignment check during user login
 * This catches existing users when new domain configurations are added
 */
export const performLoginDomainAssignment = async (
  userId: number,
  userEmail: string,
): Promise<void> => {
  try {
    // First check if we need to do anything
    const needsCheck = await shouldCheckDomainAssignment(userId, userEmail);

    if (!needsCheck) {
      return;
    }

    logger.info('Performing login-time domain assignment check', {
      userId,
      userEmail,
    });

    // Use the existing auto-assignment logic
    const assignedOrganisations = await autoAssignUserToOrganisations(userId, userEmail);

    if (assignedOrganisations.length > 0) {
      logger.info('User auto-assigned to organisations during login', {
        userId,
        userEmail,
        assignedOrganisationIds: assignedOrganisations.map((org) => org.id),
        assignedOrganisationNames: assignedOrganisations.map((org) => org.name),
      });

      // Log the login assignment completion
      const userDomain = extractAndNormalizeDomain(userEmail);
      if (userDomain) {
        logger.info('Login assignment completed', {
          userId,
          userEmail,
          userDomain,
          assignedOrganisationIds: assignedOrganisations.map((org) => org.id),
        });
      }
    } else {
      logger.debug('No new organisation assignments during login', {
        userId,
        userEmail,
      });
    }
  } catch (error) {
    logger.error('Error during login-time domain assignment', {
      userId,
      userEmail,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Don't throw error - login should not fail due to auto-assignment issues
  }
};

/**
 * Clear cache entry for a specific user (useful for testing or manual triggers)
 */
export const clearLoginAssignmentCache = (userId: number, userEmail: string): void => {
  const cacheKey = `${userId}-${userEmail}`;
  loginAssignmentCache.delete(cacheKey);
};

/**
 * Get cache statistics (useful for monitoring)
 */
export const getLoginAssignmentCacheStats = () => {
  cleanExpiredCacheEntries();
  return {
    size: loginAssignmentCache.size,
    entries: Array.from(loginAssignmentCache.entries()).map(([key, timestamp]) => ({
      key,
      timestamp,
      age: Date.now() - timestamp.getTime(),
    })),
  };
};
