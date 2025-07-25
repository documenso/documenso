import { normalizeDomain, validateDomainFormat } from '../../utils/domain';

/**
 * Basic domain validation with minimal security checks
 */
export const validateDomainSecurity = (
  domain: string,
): {
  isValid: boolean;
  reason?: string;
  severity: 'error' | 'warning';
} => {
  const normalizedDomain = normalizeDomain(domain);

  // Basic format validation
  if (!validateDomainFormat(normalizedDomain)) {
    return {
      isValid: false,
      reason: 'Invalid domain format',
      severity: 'error',
    };
  }

  // Basic security checks
  const parts = normalizedDomain.split('.');

  // Domain too short
  if (normalizedDomain.length < 4) {
    return {
      isValid: false,
      reason: 'Domain is too short',
      severity: 'error',
    };
  }

  // Must have TLD
  if (parts.length < 2) {
    return {
      isValid: false,
      reason: 'Domain must have a valid top-level domain',
      severity: 'error',
    };
  }

  // Valid TLD length
  const tld = parts[parts.length - 1];
  if (tld.length < 2) {
    return {
      isValid: false,
      reason: 'Invalid top-level domain',
      severity: 'error',
    };
  }

  return { isValid: true, severity: 'error' };
};

/**
 * Simple domain validation for the simplified system
 */
export const validateAndSecureDomain = (
  domain: string,
): {
  isValid: boolean;
  normalizedDomain: string;
  securityResult: ReturnType<typeof validateDomainSecurity>;
} => {
  const normalizedDomain = normalizeDomain(domain);
  const securityResult = validateDomainSecurity(normalizedDomain);

  return {
    isValid: securityResult.isValid,
    normalizedDomain,
    securityResult,
  };
};
