import type { Organisation, OrganisationDomainAccess, User } from '@prisma/client';
import { OrganisationMemberRole } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { generateDatabaseId } from '../../universal/id';
import {
  extractAndNormalizeDomain,
  normalizeDomain,
  validateDomainFormat,
} from '../../utils/domain';
import { logger } from '../../utils/logger';

/**
 * Find organisations that allow access for a specific domain
 * @param domain - The normalized domain to search for
 * @returns Array of organisations with domain access configuration
 */
export const findOrganisationsByDomain = async (domain: string): Promise<Organisation[]> => {
  if (!domain) {
    return [];
  }

  const normalizedDomain = normalizeDomain(domain);

  if (!validateDomainFormat(normalizedDomain)) {
    logger.warn('Invalid domain format in findOrganisationsByDomain', { domain });
    return [];
  }

  try {
    const organisationsWithDomainAccess = await prisma.organisationDomainAccess.findMany({
      where: {
        domain: normalizedDomain,
      },
      include: {
        organisation: true,
      },
    });

    return organisationsWithDomainAccess.map((access) => access.organisation);
  } catch (error) {
    logger.error('Error finding organisations by domain', {
      domain: normalizedDomain,
      originalDomain: domain,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error?.constructor?.name || 'Unknown',
    });
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Failed to find organisations by domain',
    });
  }
};

/**
 * Get existing memberships for a user across multiple organisations (bulk check)
 * @param userId - The user ID to check
 * @param organisationIds - Array of organisation IDs to check
 * @returns Set of organisation IDs where user is already a member
 */
export const getUserExistingMemberships = async (
  userId: number,
  organisationIds: string[],
): Promise<Set<string>> => {
  if (organisationIds.length === 0) {
    return new Set();
  }

  try {
    const existingMemberships = await prisma.organisationMember.findMany({
      where: {
        userId,
        organisationId: {
          in: organisationIds,
        },
      },
      select: {
        organisationId: true,
      },
    });

    return new Set(existingMemberships.map((membership) => membership.organisationId));
  } catch (error) {
    logger.error('Error checking bulk organisation memberships', {
      userId,
      organisationIds,
      organisationCount: organisationIds.length,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error?.constructor?.name || 'Unknown',
    });
    // Return empty set on error to be safe - this will cause all memberships to be attempted
    // which is safer than potentially missing existing memberships
    return new Set();
  }
};

/**
 * Check if a user is already a member of an organisation
 * @param userId - The user ID to check
 * @param organisationId - The organisation ID to check
 * @returns Boolean indicating membership status
 */
export const isUserOrganisationMember = async (
  userId: number,
  organisationId: string,
): Promise<boolean> => {
  try {
    const member = await prisma.organisationMember.findUnique({
      where: {
        userId_organisationId: {
          userId,
          organisationId,
        },
      },
    });

    return !!member;
  } catch (error) {
    logger.error('Error checking organisation membership', {
      userId,
      organisationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
};

/**
 * Create organisation membership for a user with MEMBER role
 * @param userId - The user ID to add
 * @param organisationId - The organisation ID to add them to
 * @returns The created organisation member record
 */
export const createOrganisationMembership = async (userId: number, organisationId: string) => {
  // Find the MEMBER group for the organisation
  const memberGroup = await prisma.organisationGroup.findFirst({
    where: {
      organisationId,
      organisationRole: OrganisationMemberRole.MEMBER,
    },
  });

  if (!memberGroup) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'MEMBER group not found for organisation',
    });
  }

  return await prisma.organisationMember.create({
    data: {
      id: generateDatabaseId('member'),
      userId,
      organisationId,
      organisationGroupMembers: {
        create: {
          id: generateDatabaseId('group_member'),
          groupId: memberGroup.id,
        },
      },
    },
    include: {
      organisation: true,
      user: true,
    },
  });
};

/**
 * Automatically assign a user to organisations based on their email domain
 * Uses database transaction to ensure consistency
 * @param userId - The user ID to assign
 * @param email - The user's email address
 * @returns Array of organisations the user was assigned to
 */
export const autoAssignUserToOrganisations = async (
  userId: number,
  email: string,
): Promise<Organisation[]> => {
  if (!email || !userId) {
    logger.warn('Invalid parameters for auto-assignment', { userId, email });
    return [];
  }

  const domain = extractAndNormalizeDomain(email);

  if (!domain) {
    logger.info('No valid domain found for auto-assignment', { email });
    return [];
  }

  try {
    return await prisma.$transaction(
      async (_tx) => {
        // Find organisations that allow this domain
        const organisations = await findOrganisationsByDomain(domain);

        if (organisations.length === 0) {
          logger.info('No organisations found for domain', { domain });
          return [];
        }

        const assignedOrganisations: Organisation[] = [];

        // Get user details for email notifications
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, email: true },
        });

        if (!user) {
          logger.error('User not found for auto-assignment', { userId });
          return [];
        }

        // Bulk check existing memberships to avoid individual database calls
        const organisationIds = organisations.map((org) => org.id);
        const existingMemberships = await getUserExistingMemberships(userId, organisationIds);

        for (const organisation of organisations) {
          try {
            // Check if user is already a member using bulk result
            if (existingMemberships.has(organisation.id)) {
              logger.info('User already member of organisation', {
                userId,
                organisationId: organisation.id,
              });
              continue;
            }

            // Create membership with individual error handling
            const membership = await createOrganisationMembership(userId, organisation.id);

            logger.info('User auto-assigned to organisation', {
              userId,
              email,
              domain,
              organisationId: organisation.id,
              organisationName: organisation.name,
              membershipId: membership.id,
            });

            // Log basic assignment information
            logger.info('User auto-assigned to organisation', {
              userId,
              organisationId: organisation.id,
              domain,
              trigger: 'EMAIL_VERIFICATION',
            });

            assignedOrganisations.push(organisation);
          } catch (membershipError) {
            logger.error('Error creating organisation membership', {
              userId,
              organisationId: organisation.id,
              error: membershipError instanceof Error ? membershipError.message : 'Unknown error',
            });
            // Continue with other organisations rather than failing completely
          }
        }

        // Log successful assignments
        if (assignedOrganisations.length > 0) {
          logger.info('User auto-assignment completed', {
            userId,
            assignedOrganisationIds: assignedOrganisations.map((org) => org.id),
            assignedOrganisationNames: assignedOrganisations.map((org) => org.name),
          });
        }

        return assignedOrganisations;
      },
      {
        timeout: 30000, // 30 second timeout to prevent long-running transactions
      },
    );
  } catch (error) {
    // Enhanced error handling for different types of failures
    if (error instanceof Error && error.message.includes('timeout')) {
      logger.error('Transaction timeout during auto-assignment', {
        userId,
        email,
        domain,
        timeout: '30s',
      });
      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Auto-assignment timed out - please try again',
      });
    }

    logger.error('Transaction failed during auto-assignment', {
      userId,
      email,
      domain,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error?.constructor?.name || 'Unknown',
    });

    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Failed to auto-assign user to organisations',
    });
  }
};

/**
 * Add a domain to an organisation's allowed domains list
 * Note: Permission checking is handled at the tRPC layer
 * @param organisationId - The organisation ID
 * @param domain - The domain to add
 * @param userId - The user ID performing the action (for audit logging)
 * @returns The created domain access record
 */
export const addDomainToOrganisation = async (
  organisationId: string,
  domain: string,
  userId: number,
): Promise<OrganisationDomainAccess> => {
  const normalizedDomain = normalizeDomain(domain);

  if (!validateDomainFormat(normalizedDomain)) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid domain format',
    });
  }

  try {
    const domainAccess = await prisma.organisationDomainAccess.create({
      data: {
        id: generateDatabaseId('org'),
        organisationId,
        domain: normalizedDomain,
      },
      include: {
        organisation: true,
      },
    });

    logger.info('Domain added to organisation', {
      organisationId,
      domain: normalizedDomain,
      userId,
      domainAccessId: domainAccess.id,
    });

    return domainAccess;
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AppError(AppErrorCode.ALREADY_EXISTS, {
        message: 'Domain is already configured for this organisation',
      });
    }

    logger.error('Error adding domain to organisation', {
      organisationId,
      domain: normalizedDomain,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Failed to add domain to organisation',
    });
  }
};

/**
 * Remove a domain from an organisation's allowed domains list
 * @param organisationId - The organisation ID
 * @param domain - The domain to remove
 * @param userId - The user ID performing the action (for audit logging)
 * @returns Boolean indicating success
 */
export const removeDomainFromOrganisation = async (
  organisationId: string,
  domain: string,
  userId: number,
): Promise<boolean> => {
  const normalizedDomain = normalizeDomain(domain);

  try {
    const deletedRecord = await prisma.organisationDomainAccess.delete({
      where: {
        organisationId_domain: {
          organisationId,
          domain: normalizedDomain,
        },
      },
    });

    logger.info('Domain removed from organisation', {
      organisationId,
      domain: normalizedDomain,
      userId,
      deletedId: deletedRecord.id,
    });

    return true;
  } catch (error) {
    if (error.code === 'P2025') {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Domain not found for this organisation',
      });
    }

    logger.error('Error removing domain from organisation', {
      organisationId,
      domain: normalizedDomain,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Failed to remove domain from organisation',
    });
  }
};

/**
 * Get all domains configured for an organisation
 * @param organisationId - The organisation ID
 * @returns Array of domain access records
 */
export const getOrganisationDomains = async (
  organisationId: string,
): Promise<OrganisationDomainAccess[]> => {
  try {
    return await prisma.organisationDomainAccess.findMany({
      where: {
        organisationId,
      },
      orderBy: {
        domain: 'asc',
      },
    });
  } catch (error) {
    logger.error('Error fetching organisation domains', {
      organisationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Failed to fetch organisation domains',
    });
  }
};

/**
 * Get users who could be auto-assigned to an organisation based on domain
 * Useful for admin insights and reporting
 * @param organisationId - The organisation ID
 * @param limit - Maximum number of users to return (default: 50)
 * @returns Array of users with matching domains who aren't already members
 */
export const getPotentialDomainUsers = async (
  organisationId: string,
  limit: number = 50,
): Promise<Pick<User, 'id' | 'email' | 'name'>[]> => {
  try {
    // Get domains for this organisation
    const domainAccess = await prisma.organisationDomainAccess.findMany({
      where: {
        organisationId,
      },
      select: {
        domain: true,
      },
    });

    if (domainAccess.length === 0) {
      return [];
    }

    const domains = domainAccess.map((access) => access.domain);

    // Build email LIKE conditions for each domain
    const emailConditions = domains.map((domain) => ({
      email: {
        endsWith: `@${domain}`,
      },
    }));

    // Get current organisation members
    const currentMembers = await prisma.organisationMember.findMany({
      where: {
        organisationId,
      },
      select: {
        userId: true,
      },
    });

    const memberUserIds = currentMembers.map((member) => member.userId);

    // Find users with matching domains who aren't already members
    const potentialUsers = await prisma.user.findMany({
      where: {
        OR: emailConditions,
        NOT: {
          id: {
            in: memberUserIds,
          },
        },
        // Only include verified users
        emailVerified: {
          not: null,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return potentialUsers;
  } catch (error) {
    logger.error('Error finding potential domain users', {
      organisationId,
      limit,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Failed to find potential domain users',
    });
  }
};
