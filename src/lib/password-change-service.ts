import { supabase, supabaseAdmin } from './supabase';
import { createHash } from 'crypto';

export interface PasswordChangeResult {
  success: boolean;
  error?: string;
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Password Change Service
 * Handles secure password changes with validation and database integration
 */
export class PasswordChangeService {
  /**
   * Validates password strength requirements
   */
  static validatePasswordStrength(password: string): PasswordValidationResult {
    const errors: string[] = [];
    const minLength = 12;

    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters long`);
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates that new password is different from current password
   */
  static validatePasswordDifference(currentPassword: string, newPassword: string): PasswordValidationResult {
    const errors: string[] = [];

    if (currentPassword === newPassword) {
      errors.push('New password must be different from current password');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates that new password is not already used by ANY user
   */
  static async validatePasswordUniqueness(userId: string, newPassword: string): Promise<PasswordValidationResult> {
    try {
      console.log('🔍 Checking password uniqueness for user:', userId);
      
      // Hash the new password
      const passwordHash = createHash('sha256').update(newPassword).digest('hex');
      
      // Check if this password hash already exists for ANY user
      const { data: existingPassword, error } = await supabaseAdmin
        .from('password_tracking')
        .select('id, user_id')
        .eq('password_hash', passwordHash)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('❌ Error checking password uniqueness:', error);
        return {
          isValid: false,
          errors: ['Unable to verify password uniqueness. Please try again.']
        };
      }

      if (existingPassword) {
        console.log('❌ Password already used by another user:', existingPassword.user_id);
        return {
          isValid: false,
          errors: ['This password is already in use by another user. Please choose a different password.']
        };
      }

      console.log('✅ Password is unique across all users');
      return { isValid: true, errors: [] };
    } catch (error) {
      console.error('❌ Exception during password uniqueness check:', error);
      return {
        isValid: false,
        errors: ['Password validation failed. Please try again.']
      };
    }
  }

  /**
   * Validates that new password doesn't contain personal information
   */
  static validatePasswordPersonalInfo(password: string, userInfo: {
    firstName?: string;
    lastName?: string;
    email?: string;
    studentNumber?: string;
    employeeId?: string;
  }): PasswordValidationResult {
    const errors: string[] = [];
    const passwordLower = password.toLowerCase();

    // Check for first name
    if (userInfo.firstName && passwordLower.includes(userInfo.firstName.toLowerCase())) {
      errors.push('Password cannot contain your first name');
    }

    // Check for last name
    if (userInfo.lastName && passwordLower.includes(userInfo.lastName.toLowerCase())) {
      errors.push('Password cannot contain your last name');
    }

    // Check for email username (part before @)
    if (userInfo.email) {
      const emailUsername = userInfo.email.split('@')[0].toLowerCase();
      if (passwordLower.includes(emailUsername)) {
        errors.push('Password cannot contain your email username');
      }
    }

    // Check for student number
    if (userInfo.studentNumber && passwordLower.includes(userInfo.studentNumber.toLowerCase())) {
      errors.push('Password cannot contain your student number');
    }

    // Check for employee ID
    if (userInfo.employeeId && passwordLower.includes(userInfo.employeeId.toLowerCase())) {
      errors.push('Password cannot contain your employee ID');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Verifies the current password by attempting to sign in
   */
  static async verifyCurrentPassword(email: string, currentPassword: string): Promise<{ isValid: boolean; session?: any }> {
    try {
      console.log('🔍 Verifying current password for:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword
      });

      if (error) {
        console.log('❌ Current password verification failed:', error.message);
        return { isValid: false };
      }

      console.log('✅ Current password verified successfully');
      return { isValid: true, session: data.session };
    } catch (error) {
      console.error('❌ Exception during password verification:', error);
      return { isValid: false };
    }
  }

  /**
   * Records the new password hash in the database
   */
  static async recordPasswordHash(userId: string, password: string): Promise<boolean> {
    try {
      console.log('📝 Recording new password hash for user:', userId);
      
      const passwordHash = createHash('sha256').update(password).digest('hex');
      
      const { error } = await supabaseAdmin
        .from('password_tracking')
        .upsert({
          user_id: userId,
          password_hash: passwordHash,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('❌ Error recording password hash:', error);
        return false;
      }

      console.log('✅ Password hash recorded successfully');
      return true;
    } catch (error) {
      console.error('❌ Exception recording password hash:', error);
      return false;
    }
  }

  /**
   * Changes the user's password with comprehensive validation
   */
  static async changePassword(
    userId: string,
    email: string,
    currentPassword: string,
    newPassword: string,
    userInfo: {
      firstName?: string;
      lastName?: string;
      studentNumber?: string;
      employeeId?: string;
    },
    signOutCallback?: () => Promise<void>
  ): Promise<PasswordChangeResult> {
    try {
      console.log('🔐 ===== PASSWORD CHANGE START =====');
      console.log('🔐 User ID:', userId);
      console.log('🔐 Email:', email);

      // 1. Verify current password
      console.log('🔍 Step 1: Verifying current password...');
      const passwordVerification = await this.verifyCurrentPassword(email, currentPassword);
      if (!passwordVerification.isValid) {
        return {
          success: false,
          error: 'Current password is incorrect. Please check your password and try again.'
        };
      }
      console.log('✅ Current password verified');

      // 2. Validate password strength
      console.log('🔍 Step 2: Validating password strength...');
      const strengthValidation = this.validatePasswordStrength(newPassword);
      if (!strengthValidation.isValid) {
        return {
          success: false,
          error: `Password does not meet requirements:\n\n• ${strengthValidation.errors.join('\n• ')}`
        };
      }
      console.log('✅ Password strength validated');

      // 3. Validate password difference
      console.log('🔍 Step 3: Validating password difference...');
      const differenceValidation = this.validatePasswordDifference(currentPassword, newPassword);
      if (!differenceValidation.isValid) {
        return {
          success: false,
          error: differenceValidation.errors.join('\n')
        };
      }
      console.log('✅ Password difference validated');

      // 4. Validate password uniqueness
      console.log('🔍 Step 4: Validating password uniqueness...');
      const uniquenessValidation = await this.validatePasswordUniqueness(userId, newPassword);
      if (!uniquenessValidation.isValid) {
        return {
          success: false,
          error: uniquenessValidation.errors.join('\n')
        };
      }
      console.log('✅ Password uniqueness validated');

      // 5. Validate personal information
      console.log('🔍 Step 5: Validating personal information...');
      const personalInfoValidation = this.validatePasswordPersonalInfo(newPassword, {
        ...userInfo,
        email
      });
      if (!personalInfoValidation.isValid) {
        return {
          success: false,
          error: `Password cannot contain personal information:\n\n• ${personalInfoValidation.errors.join('\n• ')}`
        };
      }
      console.log('✅ Personal information validation passed');

      // 6. Update password in Supabase Auth using admin client
      console.log('🔍 Step 6: Updating password in Supabase Auth...');
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword
      });

      if (updateError) {
        console.error('❌ Error updating password:', updateError);
        return {
          success: false,
          error: `Failed to update password: ${updateError.message}`
        };
      }
      console.log('✅ Password updated in Supabase Auth');

      // 7. Record password hash for uniqueness tracking
      console.log('🔍 Step 7: Recording password hash...');
      const hashRecorded = await this.recordPasswordHash(userId, newPassword);
      if (!hashRecorded) {
        console.warn('⚠️ Warning: Could not record password hash, but password was updated');
      }

      // 8. Sign out the user to force re-authentication with new password
      console.log('🔍 Step 8: Signing out user to force re-authentication...');
      try {
        if (signOutCallback) {
          console.log('✅ Using provided signOut callback');
          await signOutCallback();
        } else {
          console.log('⚠️ No signOut callback provided, using direct Supabase signOut');
          await supabase.auth.signOut();
        }
        console.log('✅ User signed out successfully');
      } catch (signOutError) {
        console.warn('⚠️ Warning: Could not sign out user, but password was updated');
      }

      console.log('✅ Password change completed successfully');
      console.log('🔐 ===== PASSWORD CHANGE END =====');
      
      return { success: true };
    } catch (error) {
      console.error('❌ Exception during password change:', error);
      return {
        success: false,
        error: 'An unexpected error occurred. Please try again or contact support.'
      };
    }
  }
}
