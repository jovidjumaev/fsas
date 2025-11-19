/**
 * Password Uniqueness Validator
 * Prevents users from using passwords that already exist in the system
 */

import { supabase, supabaseAdmin } from './supabase';
import { createHash } from 'crypto';
import { createLogger } from './logger';
const logger = createLogger('password-uniqueness-validator');

export interface PasswordUniquenessResult {
  isUnique: boolean;
  error?: string;
}

/**
 * Hash a password using SHA-256 (for uniqueness checking only)
 * This is NOT for secure password storage - just for uniqueness checking
 */
function hashPasswordForUniqueness(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

/**
 * Check if a password is unique across all users in the system
 * This prevents users from using passwords that already exist
 */
export async function validatePasswordUniqueness(password: string): Promise<PasswordUniquenessResult> {
  try {
    logger.log('🔐 ===== PASSWORD UNIQUENESS VALIDATION START =====');
    logger.log('🔐 Password to validate:', password);
    
    // First check against common passwords
    const commonPasswords = [
      'password', 'password123', '123456', '123456789', 'qwerty',
      'abc123', 'password1', 'admin', 'letmein', 'welcome',
      'monkey', '1234567890', 'dragon', 'master', 'hello',
      'freedom', 'whatever', 'qazwsx', 'trustno1', 'jordan',
      'Password123!', 'Password123', 'password123!', 'Password1',
      'Furman2024!', 'Furman2024', 'furman2024', 'Furman123!',
      'Student123!', 'Professor123!', 'Welcome123!', 'Hello123!'
    ];

    const lowerPassword = password.toLowerCase();
    if (commonPasswords.includes(lowerPassword) || commonPasswords.includes(password)) {
      logger.log('❌ Password is too common and likely already in use');
      return {
        isUnique: false,
        error: 'This password is too common and likely already in use. Please choose a more unique password.'
      };
    }

    // Check if password is too simple
    if (password.length < 12 || 
        !/[A-Z]/.test(password) || 
        !/[a-z]/.test(password) || 
        !/\d/.test(password) ||
        !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      logger.log('❌ Password is too simple and likely already in use');
      return {
        isUnique: false,
        error: 'This password is too simple and likely already in use. Please create a stronger, more unique password.'
      };
    }

    // Hash the password for database comparison
    const passwordHash = hashPasswordForUniqueness(password);
    
    // Check if this password hash already exists in our tracking table
    const { data: existingPassword, error } = await supabaseAdmin
      .from('password_tracking')
      .select('id')
      .eq('password_hash', passwordHash)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      logger.error('❌ Error checking password uniqueness in database:', error);
      return {
        isUnique: false, // BLOCK registration if we can't check database
        error: 'Unable to verify password uniqueness. Please try again or contact support.'
      };
    }

    if (existingPassword) {
      logger.log('❌ Password already exists in system');
      return {
        isUnique: false,
        error: 'This password is already in use by another user. Please choose a different password.'
      };
    }

    logger.log('✅ Password is unique');
    logger.log('🔐 ===== PASSWORD UNIQUENESS VALIDATION END =====');
    return { isUnique: true };

  } catch (error) {
    logger.error('❌ Error in password uniqueness validation:', error);
    return {
      isUnique: false, // BLOCK registration if we can't check
      error: 'Unable to verify password uniqueness. Please try again or contact support.'
    };
  }
}

/**
 * Record a password hash in the tracking table
 * This should be called after successful password creation
 */
export async function recordPasswordHash(userId: string, password: string): Promise<boolean> {
  try {
    logger.log('📝 Recording password hash for user:', userId);
    
    const passwordHash = hashPasswordForUniqueness(password);
    
    const { error } = await supabaseAdmin
      .from('password_tracking')
      .upsert({
        user_id: userId,
        password_hash: passwordHash
      });

    if (error) {
      logger.error('❌ Error recording password hash:', error);
      return false;
    }

    logger.log('✅ Password hash recorded successfully');
    return true;
  } catch (error) {
    logger.error('❌ Error in recordPasswordHash:', error);
    return false;
  }
}

/**
 * Check if password contains user's personal information
 * This helps prevent easily guessable passwords
 */
export function validatePasswordPersonalInfo(password: string, userData: {
  firstName?: string;
  lastName?: string;
  email?: string;
  studentNumber?: string;
  employeeId?: string;
}): PasswordUniquenessResult {
  const lowerPassword = password.toLowerCase();
  
  // Check for first name
  if (userData.firstName && lowerPassword.includes(userData.firstName.toLowerCase())) {
    return {
      isUnique: false,
      error: 'Password cannot contain your first name. Please choose a different password.'
    };
  }

  // Check for last name
  if (userData.lastName && lowerPassword.includes(userData.lastName.toLowerCase())) {
    return {
      isUnique: false,
      error: 'Password cannot contain your last name. Please choose a different password.'
    };
  }

  // Check for email username (part before @)
  if (userData.email) {
    const emailUsername = userData.email.split('@')[0].toLowerCase();
    if (lowerPassword.includes(emailUsername)) {
      return {
        isUnique: false,
        error: 'Password cannot contain your email username. Please choose a different password.'
      };
    }
  }

  // Check for student number
  if (userData.studentNumber && lowerPassword.includes(userData.studentNumber)) {
    return {
      isUnique: false,
      error: 'Password cannot contain your student number. Please choose a different password.'
    };
  }

  // Check for employee ID
  if (userData.employeeId && lowerPassword.includes(userData.employeeId.toLowerCase())) {
    return {
      isUnique: false,
      error: 'Password cannot contain your employee ID. Please choose a different password.'
    };
  }

  return { isUnique: true };
}
