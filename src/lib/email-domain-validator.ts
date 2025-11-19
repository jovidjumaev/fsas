import { createLogger } from './logger';
const logger = createLogger('email-domain-validator');

/**
 * Email Domain Validator
 * Restricts registration to only @furman.edu email addresses
 */

export interface EmailDomainResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate that email address is from an allowed domain
 * Currently only allows @furman.edu addresses
 */
export function validateEmailDomain(email: string): EmailDomainResult {
  try {
    logger.log('📧 Validating email domain for:', email);
    
    // Check if email is valid format first
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(email)) {
      return {
        isValid: false,
        error: 'Please enter a valid email address.'
      };
    }

    // Extract domain from email
    const domain = email.split('@')[1]?.toLowerCase();
    
    if (!domain) {
      return {
        isValid: false,
        error: 'Invalid email format. Please enter a valid email address.'
      };
    }

    // List of allowed domains (currently only Furman University)
    const allowedDomains = [
      'furman.edu',
      'furman.edu.', // Some email systems add trailing dot
    ];

    // Check if domain is allowed
    const isAllowed = allowedDomains.some(allowedDomain => 
      domain === allowedDomain || domain.endsWith(allowedDomain)
    );

    if (!isAllowed) {
      logger.log('❌ Email domain not allowed:', domain);
      return {
        isValid: false,
        error: 'Only @furman.edu email addresses are allowed for registration.\n\n💡 Please use your official Furman University email address.'
      };
    }

    logger.log('✅ Email domain is valid:', domain);
    return { isValid: true };

  } catch (error) {
    logger.error('❌ Error validating email domain:', error);
    return {
      isValid: false,
      error: 'Unable to validate email address. Please try again.'
    };
  }
}

/**
 * Get user-friendly domain requirements message
 */
export function getEmailDomainRequirements(): string {
  return 'Only @furman.edu email addresses are allowed for registration.\n\nThis ensures only Furman University students and faculty can access the system.';
}

/**
 * Check if email looks like a Furman email (for additional validation)
 */
export function isFurmanEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain === 'furman.edu' || domain === 'furman.edu.';
}
