import { z } from 'zod';

/**
 * Extract the domain portion from an email address
 * @param email - The email address to extract the domain from
 * @returns The domain portion of the email (after @) or null if invalid
 */
export function extractEmailDomain(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return null;
  }

  const emailRegex = /^[^\s@]+@([^\s@]+)$/;
  const match = email.trim().match(emailRegex);

  return match ? match[1].toLowerCase() : null;
}

/**
 * Zod schema for domain validation
 * Validates RFC-compliant domain formats including international domains
 */
export const ZDomainSchema = z
  .string()
  .min(1, 'Domain cannot be empty')
  .max(253, 'Domain exceeds maximum length')
  .refine(
    (domain) => {
      // Basic domain format validation
      const domainRegex =
        /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

      // Check for valid domain format
      if (!domainRegex.test(domain)) {
        return false;
      }

      // Prevent obviously malicious patterns
      const maliciousPatterns = [
        /\.\./, // consecutive dots
        /^-/, // starts with hyphen
        /-$/, // ends with hyphen
        /^[0-9.]+$/, // IP addresses only
        /localhost/i, // localhost variations
        /127\.0\.0\.1/, // loopback IP
      ];

      return !maliciousPatterns.some((pattern) => pattern.test(domain));
    },
    {
      message: 'Please enter a valid domain name (e.g., company.com)',
    },
  );

/**
 * Validate domain format using Zod schema
 * @param domain - The domain to validate
 * @returns true if domain is valid, false otherwise
 */
export function validateDomainFormat(domain: string): boolean {
  try {
    ZDomainSchema.parse(domain);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize a domain by converting to lowercase and trimming whitespace
 * @param domain - The domain to normalize
 * @returns The normalized domain string
 */
export function normalizeDomain(domain: string): string {
  if (!domain || typeof domain !== 'string') {
    return '';
  }

  return domain.trim().toLowerCase();
}

/**
 * Extract and normalize domain from email address
 * Combines extractEmailDomain and normalizeDomain for convenience
 * @param email - The email address
 * @returns The normalized domain or null if invalid
 */
export function extractAndNormalizeDomain(email: string): string | null {
  const domain = extractEmailDomain(email);
  return domain ? normalizeDomain(domain) : null;
}
