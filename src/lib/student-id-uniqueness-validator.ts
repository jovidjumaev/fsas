/**
 * Student ID Uniqueness Validator
 * Ensures student ID numbers are unique across all registered students
 */

import { supabase, supabaseAdmin } from './supabase';
import { createLogger } from './logger';
const logger = createLogger('student-id-uniqueness-validator');

export interface StudentIdUniquenessResult {
  isUnique: boolean;
  error?: string;
}

/**
 * Hash student ID for uniqueness tracking (using SHA-256)
 * This provides an additional layer of security by not storing plain text IDs
 */
function hashStudentIdForUniqueness(studentId: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(studentId.trim()).digest('hex');
}

/**
 * Validate if a student ID is unique
 * Checks both the students table and a dedicated tracking table
 */
export async function validateStudentIdUniqueness(studentId: string): Promise<StudentIdUniquenessResult> {
  logger.log('🎓 ===== STUDENT ID UNIQUENESS VALIDATION START =====');
  logger.log('🎓 Student ID to validate:', studentId);
  
  try {
    // Basic format validation first
    if (!studentId || typeof studentId !== 'string') {
      logger.log('❌ Student ID is empty or invalid');
      return {
        isUnique: false,
        error: 'Student ID is required'
      };
    }

    const trimmedId = studentId.trim();
    
    // Validate format: exactly 7 digits
    const studentIdRegex = /^\d{7}$/;
    if (!studentIdRegex.test(trimmedId)) {
      logger.log('❌ Student ID format invalid:', trimmedId);
      return {
        isUnique: false,
        error: 'Student ID must be exactly 7 digits'
      };
    }

    logger.log('✅ Student ID format is valid');

    // Check if student ID already exists in students table
    logger.log('🔍 Checking students table for existing student ID...');
    const { data: existingStudent, error: studentsError } = await supabaseAdmin
      .from('students')
      .select('student_id, user_id')
      .eq('student_id', trimmedId)
      .single();

    if (studentsError && studentsError.code !== 'PGRST116') { // PGRST116 = no rows found
      logger.error('❌ Error checking students table:', studentsError);
      return {
        isUnique: false,
        error: 'Unable to verify student ID uniqueness. Please try again or contact support.'
      };
    }

    if (existingStudent) {
      logger.log('❌ Student ID already exists in students table:', existingStudent.student_id);
      return {
        isUnique: false,
        error: 'This student ID is already registered. Please check your student ID number or contact support if you believe this is an error.'
      };
    }

    logger.log('✅ Student ID is unique in students table');

    // Additional check: Check if student ID exists in password_tracking table
    // (This provides an extra layer of security)
    logger.log('🔍 Checking password_tracking table for student ID hash...');
    const studentIdHash = hashStudentIdForUniqueness(trimmedId);
    const { data: existingHash, error: hashError } = await supabaseAdmin
      .from('password_tracking')
      .select('id')
      .eq('password_hash', studentIdHash)
      .single();

    if (hashError && hashError.code !== 'PGRST116') { // PGRST116 = no rows found
      logger.error('❌ Error checking password_tracking table:', hashError);
      // Don't fail registration for this error, just log it
      logger.warn('⚠️ Could not check password_tracking table, but students table check passed');
    } else if (existingHash) {
      logger.log('❌ Student ID hash found in password_tracking table');
      return {
        isUnique: false,
        error: 'This student ID is already in use. Please choose a different student ID or contact support.'
      };
    }

    logger.log('✅ Student ID is unique');
    logger.log('🎓 ===== STUDENT ID UNIQUENESS VALIDATION END =====');
    return { isUnique: true };

  } catch (error) {
    logger.error('❌ Exception in validateStudentIdUniqueness:', error);
    return {
      isUnique: false,
      error: 'Unable to verify student ID uniqueness. Please try again or contact support.'
    };
  }
}

/**
 * Record student ID hash for additional uniqueness tracking
 * This provides an extra layer of security beyond the database UNIQUE constraint
 */
export async function recordStudentIdHash(userId: string, studentId: string): Promise<boolean> {
  try {
    logger.log('📝 Recording student ID hash for user:', userId);
    const studentIdHash = hashStudentIdForUniqueness(studentId);
    
    const { error } = await supabaseAdmin
      .from('password_tracking')
      .upsert({ 
        user_id: userId, 
        password_hash: studentIdHash 
      });

    if (error) {
      logger.error('❌ Error recording student ID hash:', error);
      return false;
    }

    logger.log('✅ Student ID hash recorded successfully');
    return true;
  } catch (error) {
    logger.error('❌ Exception in recordStudentIdHash:', error);
    return false;
  }
}

/**
 * Validate student ID format (client-side helper)
 */
export function validateStudentIdFormat(studentId: string): { isValid: boolean; error?: string } {
  if (!studentId || typeof studentId !== 'string') {
    return { isValid: false, error: 'Student ID is required' };
  }

  const trimmedId = studentId.trim();
  
  if (trimmedId.length === 0) {
    return { isValid: false, error: 'Student ID cannot be empty' };
  }

  if (trimmedId.length !== 7) {
    return { isValid: false, error: `Student ID must be exactly 7 digits (you entered ${trimmedId.length})` };
  }

  const studentIdRegex = /^\d{7}$/;
  if (!studentIdRegex.test(trimmedId)) {
    return { isValid: false, error: 'Student ID must contain only numbers (0-9)' };
  }

  return { isValid: true };
}

/**
 * Get a list of common invalid student ID patterns
 */
export function getCommonStudentIdErrors(studentId: string): string[] {
  const errors: string[] = [];
  const trimmedId = studentId.trim();

  if (trimmedId.length < 7) {
    errors.push(`Too short: ${trimmedId.length}/7 digits`);
  }

  if (trimmedId.length > 7) {
    errors.push(`Too long: ${trimmedId.length}/7 digits`);
  }

  if (!/^\d+$/.test(trimmedId)) {
    errors.push('Contains non-numeric characters');
  }

  if (trimmedId.includes(' ')) {
    errors.push('Contains spaces');
  }

  if (trimmedId.includes('-')) {
    errors.push('Contains dashes');
  }

  return errors;
}
