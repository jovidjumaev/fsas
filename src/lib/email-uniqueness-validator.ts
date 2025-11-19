/**
 * Email Uniqueness Validator
 * Ensures email addresses are unique and from allowed domains (@furman.edu)
 */

import { supabase, supabaseAdmin } from './supabase';
import { createLogger } from './logger';
const logger = createLogger('email-uniqueness-validator');

export interface EmailValidationResult {
  isValid: boolean;
  isUnique: boolean;
  error?: string;
}

/**
 * Validate email domain (must be @furman.edu)
 */
function validateEmailDomain(email: string): { isValid: boolean; error?: string } {
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
 * Check if email already exists in the system
 */
async function checkEmailUniqueness(email: string): Promise<{ isUnique: boolean; error?: string }> {
  try {
    logger.log('🔍 Checking email uniqueness for:', email);
    
    // Check 1: Supabase Auth users
    logger.log('🔍 Checking Supabase Auth users...');
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      logger.error('❌ Error checking auth users:', authError);
      return {
        isUnique: false,
        error: 'Unable to verify email availability. Please try again or contact support.'
      };
    }

    const duplicateAuthUser = authUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (duplicateAuthUser) {
      logger.log('❌ Email found in auth users:', duplicateAuthUser.id);
      
      // Check if they have a profile to give better guidance
      const { data: existingProfile } = await supabaseAdmin
        .from('users')
        .select('role, first_name, last_name')
        .eq('id', duplicateAuthUser.id)
        .single();
      
      if (existingProfile) {
        return {
          isUnique: false,
          error: `This email is already registered as a ${existingProfile.role}.\n\n💡 Please sign in instead:\n   • Go to /${existingProfile.role}/login\n   • Use your email and password\n   • Or click "Forgot Password" if needed`
        };
      } else {
        return {
          isUnique: false,
          error: 'This email is already in use but the account is incomplete.\n\n💡 Please contact support or try using a different email address.'
        };
      }
    }

    logger.log('✅ Email not found in auth users');

    // Check 2: Users table (additional check)
    logger.log('🔍 Checking users table...');
    const { data: usersData, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email, role, first_name, last_name')
      .eq('email', email.toLowerCase())
      .single();

    if (usersError && usersError.code !== 'PGRST116') { // PGRST116 = no rows found
      logger.error('❌ Error checking users table:', usersError);
      return {
        isUnique: false,
        error: 'Unable to verify email availability. Please try again or contact support.'
      };
    }

    if (usersData) {
      logger.log('❌ Email found in users table:', usersData.id);
      return {
        isUnique: false,
        error: `This email is already registered as a ${usersData.role}.\n\n💡 Please sign in instead:\n   • Go to /${usersData.role}/login\n   • Use your email and password\n   • Or click "Forgot Password" if needed`
      };
    }

    logger.log('✅ Email not found in users table');
    return { isUnique: true };

  } catch (error) {
    logger.error('❌ Exception in checkEmailUniqueness:', error);
    return {
      isUnique: false,
      error: 'Unable to verify email availability. Please try again or contact support.'
    };
  }
}

/**
 * Comprehensive email validation (domain + uniqueness)
 */
export async function validateEmailUniqueness(email: string): Promise<EmailValidationResult> {
  logger.log('📧 ===== EMAIL UNIQUENESS VALIDATION START =====');
  logger.log('📧 Email to validate:', email);
  
  try {
    // Step 1: Validate email format and domain
    const domainValidation = validateEmailDomain(email);
    if (!domainValidation.isValid) {
      logger.log('❌ Email domain validation failed:', domainValidation.error);
      return {
        isValid: false,
        isUnique: false,
        error: domainValidation.error
      };
    }
    
    logger.log('✅ Email domain validation passed');

    // Step 2: Check email uniqueness
    const uniquenessValidation = await checkEmailUniqueness(email);
    if (!uniquenessValidation.isUnique) {
      logger.log('❌ Email uniqueness validation failed:', uniquenessValidation.error);
      return {
        isValid: true,
        isUnique: false,
        error: uniquenessValidation.error
      };
    }

    logger.log('✅ Email uniqueness validation passed');
    logger.log('📧 ===== EMAIL UNIQUENESS VALIDATION END =====');
    
    return {
      isValid: true,
      isUnique: true
    };

  } catch (error) {
    logger.error('❌ Exception in validateEmailUniqueness:', error);
    return {
      isValid: false,
      isUnique: false,
      error: 'Unable to validate email address. Please try again or contact support.'
    };
  }
}

/**
 * Client-side email format validation (for real-time feedback)
 */
export function validateEmailFormat(email: string): { isValid: boolean; error?: string } {
  if (!email || email.trim().length === 0) {
    return { isValid: false, error: 'Email address is required' };
  }

  const trimmedEmail = email.trim();
  
  // Basic email format validation
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  if (!emailRegex.test(trimmedEmail)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  // Check if it's a Furman email
  const domain = trimmedEmail.split('@')[1]?.toLowerCase();
  if (domain !== 'furman.edu' && domain !== 'furman.edu.') {
    return { 
      isValid: false, 
      error: 'Only @furman.edu email addresses are allowed' 
    };
  }

  return { isValid: true };
}

/**
 * Get user-friendly email requirements message
 */
export function getEmailRequirements(): string {
  return 'Please use your official @furman.edu email address for registration.';
}

/**
 * Check if email looks like a Furman email (for additional validation)
 */
export function isFurmanEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain === 'furman.edu' || domain === 'furman.edu.';
}

/**
 * Format email for display (mask sensitive parts)
 */
export function formatEmailForDisplay(email: string): string {
  if (!email || !email.includes('@')) {
    return email;
  }

  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) {
    return email;
  }

  const maskedLocal = localPart[0] + '*'.repeat(localPart.length - 2) + localPart[localPart.length - 1];
  return `${maskedLocal}@${domain}`;
}
