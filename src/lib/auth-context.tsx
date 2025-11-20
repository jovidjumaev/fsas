'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, supabaseAdmin } from './supabase';
import {
  parseSupabaseError,
  logDetailedError,
  testDatabaseConnection,
  retryOperation,
  validateRequiredFields,
  formatErrorForUser
} from './error-handler';
import { authLogger as logger } from './logger';
import { SignOutService } from './sign-out-service';

const supabaseClient = supabase as any;
const supabaseAdminClient = supabaseAdmin as any;

interface AuthContextType {
  user: User | null;
  userRole: 'student' | 'professor' | null;
  loading: boolean;
  signIn: (email: string, password: string, role: 'student' | 'professor') => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, role: 'student' | 'professor', additionalData: any) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string, role: 'student' | 'professor') => Promise<{ success: boolean; error?: string }>;
  updatePassword: (token: string, password: string, type: 'student' | 'professor') => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'student' | 'professor' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logger.debug('Initializing...');
    logger.debug('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    logger.debug('Supabase Key exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    // Timeout to prevent infinite loading - reduced for faster load
    const timeoutId = setTimeout(() => {
      logger.warn('Initialization timeout - forcing loading to false');
      setLoading(false);
    }, 1500); // 1.5 second timeout for faster initialization
    
    // Get initial session
    const getInitialSession = async () => {
      try {
        logger.log('🔐 AuthContext: Getting initial session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          logger.error('❌ AuthContext: Session error:', error);
        } else {
          logger.log('🔐 AuthContext: Session result:', { 
            hasSession: !!session, 
            hasUser: !!session?.user,
            userId: session?.user?.id 
          });
        }
        
        if (session?.user) {
          logger.log('🔐 AuthContext: User found, fetching role...');
          setUser(session.user);
          await fetchUserRole(session.user.id);
        } else {
          logger.log('🔐 AuthContext: No user in session');
        }
      } catch (error) {
        logger.error('❌ AuthContext: Initial session error:', error);
      } finally {
        clearTimeout(timeoutId);
        logger.log('🔐 AuthContext: Setting loading to false');
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    logger.log('🔐 AuthContext: Setting up auth state listener...');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logger.log('🔐 AuthContext: Auth state changed:', { event, hasSession: !!session, hasUser: !!session?.user });
        
        if (session?.user) {
          setUser(session.user);
          await fetchUserRole(session.user.id);
        } else {
          setUser(null);
          setUserRole(null);
        }
        setLoading(false);
      }
    );

    return () => {
      logger.log('🔐 AuthContext: Cleaning up auth listener');
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserRole = async (userId: string, retryCount = 0) => {
    try {
      logger.log('🔐 Fetching user role for:', userId, retryCount > 0 ? `(retry ${retryCount})` : '');
      
      // Add timeout to prevent hanging - increased from 3s to 15s for better stability
      const rolePromise = supabaseClient
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();
      
      const timeoutPromise = new Promise((unused, reject) =>
        setTimeout(() => reject(new Error('Role fetch timeout')), 3000) // 3 seconds for faster initialization
      );
      
      const { data: userData, error: userError } = await Promise.race([
        rolePromise,
        timeoutPromise
      ]) as any;

      if (userError) {
        logger.error('Error fetching user role:', userError);
        
        // Retry logic for temporary failures - reduced retries to prevent loops
        if (retryCount < 1 && (userError.message?.includes('timeout') || userError.message?.includes('network'))) {
          logger.log('🔐 Retrying role fetch in 2 seconds...');
          setTimeout(() => fetchUserRole(userId, retryCount + 1), 2000);
          return;
        }
        
        logger.log('🔐 Attempting fallback role detection...');
        
        // Fallback: Check if users table exists but couldn't find user
        logger.log('🔐 Could not fetch role from users table');
        // No additional fallback needed - users is the main table
        
        // Don't set userRole to null on failure - keep existing role to prevent UI issues
        logger.log('🔐 Keeping existing role to prevent UI disruption');
        return;
      }

      if (userData?.role) {
        logger.log('🔐 Found role:', userData.role);
        setUserRole(userData.role as 'student' | 'professor');
        return;
      }

      logger.warn('🔐 No role found for user');
      // Don't set to null - keep existing role
      logger.log('🔐 Keeping existing role to prevent UI disruption');
    } catch (error: unknown) {
      logger.error('Error fetching user role:', error);
      
      // Retry logic for timeout errors - reduced retries
      if (
        retryCount < 1 &&
        error instanceof Error &&
        error.message?.includes('timeout')
      ) {
        logger.log('🔐 Retrying role fetch after timeout...');
        setTimeout(() => fetchUserRole(userId, retryCount + 1), 2000);
        return;
      }
      
      // Don't set userRole to null on failure - keep existing role
      logger.log('🔐 Keeping existing role to prevent UI disruption');
    }
  };

  const signIn = async (email: string, password: string, role: 'student' | 'professor') => {
    try {
      logger.log('🔐 AuthContext: ===== SIGN-IN PROCESS STARTED =====');
      logger.log('🔐 AuthContext: Input parameters:', { 
        email, 
        role, 
        passwordLength: password?.length || 0,
        passwordProvided: !!password
      });
      logger.log('🔐 AuthContext: Environment check:', {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseKeyExists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        supabaseKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0
      });
      logger.log('🔐 AuthContext: Current state:', { 
        user: !!user, 
        userRole,
        loading
      });
      
      // Validate input
      if (!email || !password) {
        logger.error('❌ AuthContext: VALIDATION FAILED - Missing credentials');
        logger.error('❌ AuthContext: Email provided:', !!email);
        logger.error('❌ AuthContext: Password provided:', !!password);
        return { success: false, error: 'Please provide both email and password' };
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        logger.error('❌ AuthContext: VALIDATION FAILED - Invalid email format');
        return { success: false, error: 'Please enter a valid email address' };
      }

      // Validate password length
      if (password.length < 6) {
        logger.error('❌ AuthContext: VALIDATION FAILED - Password too short');
        return { success: false, error: 'Password must be at least 6 characters long' };
      }
      
      logger.log('🔐 AuthContext: Input validation passed');
      logger.log('🔐 AuthContext: Attempting Supabase authentication...');
      logger.log('🔐 AuthContext: Start time:', new Date().toISOString());
      
      // Sign in without timeout - let Supabase handle it
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      
      logger.log('🔐 AuthContext: Auth completed at:', new Date().toISOString());

      logger.log('🔐 AuthContext: ===== SUPABASE AUTH RESPONSE =====');
      logger.log('🔐 AuthContext: Response data:', {
        hasData: !!data,
        hasUser: !!data?.user,
        hasSession: !!data?.session,
        userId: data?.user?.id,
        userEmail: data?.user?.email,
        userEmailConfirmed: data?.user?.email_confirmed_at ? 'YES' : 'NO',
        userCreatedAt: data?.user?.created_at,
        userLastSignIn: data?.user?.last_sign_in_at
      });
      logger.log('🔐 AuthContext: Response error:', {
        hasError: !!error,
        errorMessage: error?.message,
        errorStatus: error?.status,
        errorCode: error?.code
      });

      if (error) {
        logDetailedError('Sign-In Authentication', error, {
          email,
          role,
          timestamp: new Date().toISOString()
        });
        
        const parsedError = parseSupabaseError(error, 'sign-in');
        return { 
          success: false, 
          error: formatErrorForUser(parsedError)
        };
      }

      // Check if email is confirmed before proceeding
      if (data.user && !data.user.email_confirmed_at) {
        logger.log('🔐 AuthContext: Email not confirmed, blocking sign-in');
        return {
          success: false,
          error: 'Please check your email and click the confirmation link before signing in.\n\n📧 Check your spam folder if you don\'t see the confirmation email.'
        };
      }

      if (data.user) {
        logger.log('✅ AuthContext: ===== AUTHENTICATION SUCCESSFUL =====');
        logger.log('✅ AuthContext: User authenticated successfully');
        logger.log('🔐 AuthContext: User details:', {
          id: data.user.id,
          email: data.user.email,
          emailConfirmed: data.user.email_confirmed_at ? 'YES' : 'NO',
          emailConfirmedAt: data.user.email_confirmed_at,
          createdAt: data.user.created_at,
          lastSignInAt: data.user.last_sign_in_at,
          appMetadata: data.user.app_metadata,
          userMetadata: data.user.user_metadata
        });
        
        // WORKAROUND: Database queries hanging in browser - use metadata instead
        logger.log('🔍 AuthContext: ===== CHECKING USER PROFILE =====');
        logger.log('🔍 AuthContext: Using user metadata instead of database query');
        logger.log('🔍 AuthContext: User metadata:', data.user.user_metadata);
        logger.log('🔍 AuthContext: Expected role:', role);
        
        // Get role from user metadata (set during registration)
        const userMetadata = data.user.user_metadata || {};
        const userRole = userMetadata.role;
        
        logger.log('🔍 AuthContext: Role from metadata:', userRole);
        
        // Verify role matches what was expected
        if (userRole !== role) {
          logger.error('❌ AuthContext: Role mismatch');
          logger.log('Expected:', role, 'Got:', userRole);
          await supabase.auth.signOut();
          return {
            success: false,
            error: `This account is registered as a ${userRole}. Please use the ${userRole} login page instead.`
          };
        }
        
        logger.log('✅ AuthContext: Role verified from metadata');

        logger.log('✅ AuthContext: ===== ROLE VERIFICATION PASSED =====');
        logger.log('✅ AuthContext: Role verified successfully');
        logger.log('✅ AuthContext: Welcome', data.user.email, `(${role})`);
        
        // Set user and role state
        logger.log('🔐 AuthContext: ===== UPDATING STATE =====');
        setUser(data.user);
        setUserRole(role);
        
        logger.log('🔐 AuthContext: State updated successfully:', { 
          user: !!data.user, 
          userRole: role,
          userId: data.user.id,
          userEmail: data.user.email
        });
        
        logger.log('🎉 AuthContext: ===== SIGN-IN COMPLETED SUCCESSFULLY =====');
        return { success: true };
      }

      logger.error('❌ AuthContext: ===== NO USER RETURNED =====');
      logger.error('❌ AuthContext: Authentication succeeded but no user object returned');
      return { success: false, error: 'Sign in failed - no user data returned' };
    } catch (error: any) {
      logger.error('❌ AuthContext: ===== UNEXPECTED ERROR =====');
      logger.error('❌ AuthContext: Error type:', typeof error);
      logger.error('❌ AuthContext: Error message:', error?.message);
      logger.error('❌ AuthContext: Error code:', error?.code);
      logger.error('❌ AuthContext: Error name:', error?.name);
      logger.error('❌ AuthContext: Full error object:', error);
      
      return { 
        success: false, 
        error: error?.message || 'An unexpected error occurred. Please try again.' 
      };
    }
  };

  const signUp = async (email: string, password: string, role: 'student' | 'professor', additionalData: any) => {
    try {
      logger.log('🚀 AuthContext: Starting signUp process');
      logger.log('📧 Email:', email);
      logger.log('👤 Role:', role);
      logger.log('📝 Additional Data:', {
        firstName: additionalData.firstName,
        lastName: additionalData.lastName,
        ...(role === 'student' ? { studentNumber: additionalData.studentNumber } : { employeeId: additionalData.employeeId })
      });
      
      // Validate required fields
      const requiredFields = ['firstName', 'lastName'];
      if (role === 'student') {
        requiredFields.push('studentNumber');
      } else {
        requiredFields.push('employeeId');
      }
      
      const validation = validateRequiredFields(additionalData, requiredFields);
      if (!validation.valid) {
        logger.error('❌ Required fields validation failed:', validation.missingFields);
        return {
          success: false,
          error: validation.message || 'Please fill in all required fields'
        };
      }

      // Validate student ID format (exactly 7 digits)
      if (role === 'student') {
        const studentNumberRegex = /^\d{7}$/;
        if (!studentNumberRegex.test(additionalData.studentNumber?.trim() || '')) {
          logger.error('❌ Invalid student ID format:', additionalData.studentNumber);
          return {
            success: false,
            error: 'Student ID must be exactly 7 digits.\n\n💡 Example: 5002378\n\nPlease enter your official university student ID number.'
          };
        }
        logger.log('✅ Student ID format validated:', additionalData.studentNumber);
        
        // Validate student ID uniqueness
        logger.log('🎓 ===== STUDENT ID UNIQUENESS VALIDATION START =====');
        logger.log('🎓 Validating student ID uniqueness...');
        
        try {
          const { validateStudentIdUniqueness } = await import('./student-id-uniqueness-validator');
          logger.log('🎓 Import successful');
          
          const studentIdUniquenessValidation = await validateStudentIdUniqueness(additionalData.studentNumber);
          logger.log('🎓 Validation result:', studentIdUniquenessValidation);
          
          if (!studentIdUniquenessValidation.isUnique) {
            logger.error('❌ Student ID uniqueness validation failed:', studentIdUniquenessValidation.error);
            return {
              success: false,
              error: studentIdUniquenessValidation.error || 'Student ID is not unique'
            };
          }
          
          logger.log('✅ Student ID uniqueness validation passed');
        } catch (validationError) {
          logger.error('❌ Error during student ID validation:', validationError);
          return {
            success: false,
            error: 'Student ID validation failed. Please try again.'
          };
        }
      }

      // Validate employee ID format and uniqueness (for professors)
      if (role === 'professor') {
        logger.log('👨‍🏫 ===== EMPLOYEE ID VALIDATION START =====');
        logger.log('👨‍🏫 Validating employee ID format and uniqueness...');
        
        // Basic format validation
        if (!additionalData.employeeId || additionalData.employeeId.trim().length !== 7) {
          logger.error('❌ Invalid employee ID format:', additionalData.employeeId);
          return {
            success: false,
            error: 'Employee ID must be exactly 7 digits.\n\n💡 Example: 1234567\n\nPlease enter your official employee ID number.'
          };
        }
        
        // Format validation (exactly 7 digits)
        const employeeIdRegex = /^\d{7}$/;
        if (!employeeIdRegex.test(additionalData.employeeId.trim())) {
          logger.error('❌ Invalid employee ID format:', additionalData.employeeId);
          return {
            success: false,
            error: 'Employee ID must be exactly 7 digits.\n\n💡 Example: 1234567\n\nPlease enter your official employee ID number.'
          };
        }
        logger.log('✅ Employee ID format validated:', additionalData.employeeId);
        
        // Validate employee ID uniqueness
        logger.log('👨‍🏫 Validating employee ID uniqueness...');
        
        try {
          const { validateEmployeeIdUniqueness } = await import('./employee-id-uniqueness-validator');
          logger.log('👨‍🏫 Import successful');
          
          const employeeIdValidation = await validateEmployeeIdUniqueness(additionalData.employeeId);
          logger.log('👨‍🏫 Validation result:', employeeIdValidation);
          
          if (!employeeIdValidation.isUnique) {
            logger.error('❌ Employee ID uniqueness validation failed:', employeeIdValidation.error);
            return {
              success: false,
              error: employeeIdValidation.error || 'Employee ID is not unique'
            };
          }
          
          logger.log('✅ Employee ID uniqueness validation passed');
        } catch (validationError) {
          logger.error('❌ Error during employee ID validation:', validationError);
          return {
            success: false,
            error: 'Employee ID validation failed. Please try again.'
          };
        }
      }
      
      // Test database connection first
      logger.log('🔍 Testing database connection...');
      const dbTest = await testDatabaseConnection(supabase);
      if (dbTest) {
        logger.error('❌ Database connection test failed');
        return {
          success: false,
          error: formatErrorForUser(dbTest)
        };
      }
      logger.log('✅ Database connection successful');
      
      // Validate password strength
      logger.log('🔐 Validating password strength...');
      const { validatePassword } = await import('./password-validator');
      const passwordValidation = validatePassword(password);
      
      if (!passwordValidation.isValid) {
        logger.error('❌ Password validation failed:', passwordValidation.errors);
        return { 
          success: false, 
          error: passwordValidation.errors[0] || 'Password does not meet security requirements' 
        };
      }
      
      if (!passwordValidation.strength.isValid) {
        logger.error('❌ Password strength insufficient');
        return { 
          success: false, 
          error: 'Password is not strong enough. Please create a more secure password.' 
        };
      }
      
      logger.log('✅ Password validation passed');
      
      // Validate email domain and uniqueness (only allow @furman.edu and must be unique)
      logger.log('📧 ===== EMAIL VALIDATION START =====');
      logger.log('📧 Validating email domain and uniqueness...');
      
      // Check email domain
      if (!email.endsWith('@furman.edu')) {
        logger.error('❌ Email domain validation failed');
        return {
          success: false,
          error: 'Only @furman.edu email addresses are allowed for registration.\n\n💡 Please use your official Furman University email address.'
        };
      }
      
      // Check if email already exists in users table
      logger.log('🔍 Checking if email already exists in users table...');
      const { data: existingUser, error: userCheckError } = await supabaseClient
        .from('users')
        .select('id, role, first_name, last_name')
        .eq('email', email.toLowerCase())
        .maybeSingle();
      
      if (userCheckError && userCheckError.code !== 'PGRST116') { // PGRST116 = no rows found
        logger.error('❌ Error checking users table:', userCheckError);
        return {
          success: false,
          error: 'Unable to verify email availability. Please try again or contact support.'
        };
      }
      
      if (existingUser) {
        logger.error('❌ Email already exists in users table:', existingUser.id);
        return {
          success: false,
          error: `This email is already registered as a ${existingUser.role}.\n\n💡 Please sign in instead:\n   • Go to /${existingUser.role}/login\n   • Use your email and password\n   • Or click "Forgot Password" if needed`
        };
      }
      
      logger.log('✅ Email validation passed');
      
      // Validate password uniqueness
      logger.log('🔐 ===== PASSWORD UNIQUENESS VALIDATION START =====');
      logger.log('🔐 Password to validate:', password);
      logger.log('🔐 Validating password uniqueness...');
      
      try {
        const { validatePasswordUniqueness, validatePasswordPersonalInfo } = await import('./password-uniqueness-validator');
        logger.log('🔐 Import successful');
        
        const passwordUniquenessValidation = await validatePasswordUniqueness(password);
        logger.log('🔐 Validation result:', passwordUniquenessValidation);
        
        if (!passwordUniquenessValidation.isUnique) {
          logger.error('❌ Password uniqueness validation failed:', passwordUniquenessValidation.error);
          return {
            success: false,
            error: passwordUniquenessValidation.error || 'Password is not unique'
          };
        }
        
        logger.log('✅ Password uniqueness validation passed');
        
        // Check if password contains personal information
        const personalInfoValidation = validatePasswordPersonalInfo(password, {
          firstName: additionalData.firstName,
          lastName: additionalData.lastName,
          email: email,
          studentNumber: additionalData.studentNumber,
          employeeId: additionalData.employeeId
        });
        
        if (!personalInfoValidation.isUnique) {
          logger.error('❌ Password personal info validation failed:', personalInfoValidation.error);
          return {
            success: false,
            error: personalInfoValidation.error || 'Password contains personal information'
          };
        }
        
        logger.log('✅ Password personal info validation passed');
      } catch (validationError) {
        logger.error('❌ Error during password validation:', validationError);
        return {
          success: false,
          error: 'Password validation failed. Please try again.'
        };
      }
      
      // Email uniqueness already validated above, proceeding with registration
      logger.log('✅ Email is available, proceeding with registration...');
      
      // First, create the auth user with metadata and email confirmation
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: additionalData.firstName,
            last_name: additionalData.lastName,
            role: role
          },
          // Enable email confirmation for new users
          emailRedirectTo: `${process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://fsas-frontend.vercel.app'}/auth/confirm?type=${role}`
        }
      });

      logger.log('AuthContext: Supabase auth response', { authData, signUpError });

      if (signUpError) {
        logDetailedError('Supabase Auth SignUp', signUpError, {
          email,
          role
        });
        
        // Handle specific error cases
        if (signUpError.message.includes('already registered') || signUpError.message.includes('already exists')) {
          return { 
            success: false, 
            error: `This email is already registered.\n\n💡 Please sign in instead at /${role}/login` 
          };
        }
        
        const parsedError = parseSupabaseError(signUpError, 'account creation');
        return { success: false, error: formatErrorForUser(parsedError) };
      }

      if (!authData.user) {
        logger.error('AuthContext: No user created');
        return { 
          success: false, 
          error: 'Account creation failed. No user data returned.\n\n💡 Please try again or contact support if this persists.' 
        };
      }

      // Check if email confirmation is required for new users
      if (!authData.user.email_confirmed_at) {
        logger.log('AuthContext: Email confirmation required for new user');
        return {
          success: true,
          requiresEmailConfirmation: true,
          message: `Account created successfully! Please check your email (${email}) and click the confirmation link to activate your account.\n\n📧 Check your spam folder if you don't see the email.`
        };
      }

      // Wait for the trigger to create the user profile, then verify it exists
      logger.log('AuthContext: Waiting for user profile creation...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if user profile was created by trigger using admin client to bypass RLS
      const { data: userProfile, error: userProfileError } = await supabaseAdminClient
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (userProfileError && userProfileError.code !== 'PGRST116') {
        logger.error('AuthContext: Error checking user profile:', userProfileError);
        const parsedError = parseSupabaseError(userProfileError, 'user profile check');
        return {
          success: false,
          error: formatErrorForUser(parsedError)
        };
      }

      if (!userProfile) {
        logger.log('AuthContext: User profile not created by trigger, creating manually...');

        // Create user profile manually using admin client to bypass RLS
        const { error: userError } = await supabaseAdminClient
          .from('users')
          .insert({
            id: authData.user.id,
            email: email,
            first_name: additionalData.firstName,
            last_name: additionalData.lastName,
            role: role
          });

        if (userError) {
          // Check if it's a duplicate key error (record was created by trigger after our check)
          if (userError.code === '23505') {
            logger.log('ℹ️ User profile already exists (created by trigger), continuing...');
          } else {
            logDetailedError('Create User Profile', userError, {
              userId: authData.user.id,
              email: authData.user.email,
              role,
              firstName: additionalData.firstName,
              lastName: additionalData.lastName
            });

            const parsedError = parseSupabaseError(userError, 'user profile creation');
            return {
              success: false,
              error: formatErrorForUser(parsedError)
            };
          }
        }
      } else {
        logger.log('✅ User profile already exists (created by trigger)');
      }

      // Create role-specific data with proper error handling
      try {
        if (role === 'student') {
          logger.log('🎓 Creating student record...');
          
          const { data: existingStudent, error: existingStudentError } = await supabaseAdminClient
            .from('students')
            .select('user_id')
            .eq('user_id', authData.user.id)
            .maybeSingle();

          if (existingStudentError && existingStudentError.code !== 'PGRST116') {
            throw new Error(`Failed to verify existing student record: ${existingStudentError.message}`);
          }

          if (existingStudent) {
            logger.log('ℹ️ Student record already exists, skipping insert');
          } else {
            // Generate a student ID if none provided
            let studentId = additionalData.studentNumber;
            if (!studentId || studentId.trim() === '') {
              // Generate a unique student ID
              const timestamp = Date.now();
              const random = Math.floor(Math.random() * 1000);
              studentId = `500${timestamp.toString().slice(-6)}${random.toString().padStart(3, '0')}`;
              logger.log('🔢 Generated student ID:', studentId);
            }
            
            const { data: studentData, error: studentError } = await supabaseAdminClient
              .from('students')
              .insert({
                user_id: authData.user.id,
                student_id: studentId,
                enrollment_year: new Date().getFullYear(),
                major: additionalData.major || 'Computer Science',
                created_at: new Date().toISOString()
              })
              .select()
              .maybeSingle();

            if (studentError) {
              if (studentError.code === '23505') {
                logger.warn('⚠️ Duplicate student record detected during insert, continuing');
              } else {
                logger.error('❌ Failed to create student record:', studentError);
                // This is critical - fail the registration if student record creation fails
                throw new Error(`Failed to create student record: ${studentError.message}`);
              }
            } else {
              logger.log('✅ Student record created successfully:', studentData);
            }
          }
        } else if (role === 'professor') {
          logger.log('👨‍🏫 Creating professor record...');

          const { data: existingProfessor, error: existingProfessorError } = await supabaseAdminClient
            .from('professors')
            .select('user_id')
            .eq('user_id', authData.user.id)
            .maybeSingle();

          if (existingProfessorError && existingProfessorError.code !== 'PGRST116') {
            throw new Error(`Failed to verify existing professor record: ${existingProfessorError.message}`);
          }

          if (existingProfessor) {
            logger.log('ℹ️ Professor record already exists, skipping insert');
          } else {
            const { data: professorData, error: professorError } = await supabaseAdminClient
              .from('professors')
              .insert({
                user_id: authData.user.id,
                employee_id: additionalData.employeeId,
                title: additionalData.title || 'Professor',
                office_location: additionalData.office_location || '',
                phone: additionalData.phone || '',
                created_at: new Date().toISOString()
              })
              .select()
              .single();

            if (professorError) {
              if (professorError.code === '23505') {
                logger.warn('⚠️ Duplicate professor record detected during insert, continuing');
              } else {
                logger.error('❌ Failed to create professor record:', professorError);
                // This is critical - fail the registration if professor record creation fails
                throw new Error(`Failed to create professor record: ${professorError.message}`);
              }
            } else {
              logger.log('✅ Professor record created successfully:', professorData);
            }
          }
        }
      } catch (roleError: unknown) {
        logger.error('❌ Role-specific record creation failed:', roleError);
        
        // Clean up: Delete the user if role-specific record creation failed
        logger.log('🧹 Cleaning up user record due to role creation failure...');
        try {
          await supabaseAdminClient.auth.admin.deleteUser(authData.user.id);
          logger.log('✅ User record cleaned up successfully');
        } catch (cleanupError) {
          logger.error('❌ Failed to clean up user record:', cleanupError);
        }
        
        // Return error to user
        return {
          success: false,
          error: `Registration failed: ${
            roleError instanceof Error ? roleError.message : 'Unknown error'
          }\n\n💡 Please try again or contact support if this persists.`
        };
      }

      logger.log('✅ User profile created with role:', role);

      // Record password hash for uniqueness tracking
      logger.log('📝 Recording password hash for uniqueness tracking...');
      const { recordPasswordHash } = await import('./password-uniqueness-validator');
      await recordPasswordHash(authData.user.id, password);

      // Record student ID hash for uniqueness tracking (if student)
      if (role === 'student' && additionalData.studentNumber) {
        logger.log('📝 Recording student ID hash for uniqueness tracking...');
        const { recordStudentIdHash } = await import('./student-id-uniqueness-validator');
        await recordStudentIdHash(authData.user.id, additionalData.studentNumber);
      }

      // Record employee ID hash for uniqueness tracking (if professor)
      if (role === 'professor' && additionalData.employeeId) {
        logger.log('📝 Recording employee ID hash for uniqueness tracking...');
        const { recordEmployeeIdHash } = await import('./employee-id-uniqueness-validator');
        await recordEmployeeIdHash(authData.user.id, additionalData.employeeId);
      }

      setUser(authData.user);
      setUserRole(role);
      return { success: true };
    } catch (error: unknown) {
      logger.error('Sign up error:', error);
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      return { success: false, error: message };
    }
  };

  const signOut = async () => {
    logger.log('🔐 AuthContext: Starting optimized sign out process...');

    // CRITICAL: Store the current user role FIRST before any clearing
    // This ensures we always have the correct role for redirect
    const currentUserRole = userRole;

    // Determine redirect URL immediately to avoid any state race conditions
    const redirectUrl = currentUserRole === 'professor'
      ? '/professor/login'
      : currentUserRole === 'student'
      ? '/student/login'
      : '/'; // Fallback to home only if no role is set

    logger.log(`🔐 AuthContext: Will redirect to ${redirectUrl} (role: ${currentUserRole})`);

    // Start the redirect immediately to provide instant feedback
    // This prevents the homepage from showing while we clean up
    if (typeof window !== 'undefined') {
      // Use replace to prevent back button issues
      window.location.replace(redirectUrl);
    }

    // Clear everything in the background after redirect starts
    // The page will be replaced anyway, so these operations won't block the UI
    try {
      // Clear Supabase session
      await supabase.auth.signOut();
      logger.log('🔐 AuthContext: Supabase session cleared');
    } catch (error) {
      logger.error('🔐 AuthContext: Error clearing session:', error);
    }

    // Clear browser storage (preserving theme)
    if (typeof window !== 'undefined') {
      const darkMode = localStorage.getItem('darkMode');
      localStorage.clear();
      if (darkMode !== null) {
        localStorage.setItem('darkMode', darkMode);
      }
      sessionStorage.clear();
    }

    // Clear SWR caches
    await SignOutService.clearAllCaches();

    // Clear local state (though page is already redirecting)
    setUser(null);
    setUserRole(null);
  };

  const resetPassword = async (email: string, role: 'student' | 'professor') => {
    try {
      logger.log('🔐 AuthContext: ===== PASSWORD RESET REQUEST =====');
      logger.log('🔐 AuthContext: Email:', email, 'Role:', role);
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { success: false, error: 'Please enter a valid email address' };
      }

      // Simplified approach: Check users table first, then try password reset
      logger.log('🔐 AuthContext: Checking users table for user...');
      
      const { data: userData, error: userError } = await supabaseAdminClient
        .from('users')
        .select('id, email, role')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      let userRole = null;
      
      if (userError && userError.code === 'PGRST116') {
        // User not found in users table - assume they exist in Auth and use provided role
        logger.log('🔐 AuthContext: User not found in users table, using provided role:', role);
        userRole = role;
      } else if (userError) {
        logger.error('🔐 AuthContext: Error querying users table:', userError);
        return { success: false, error: 'Unable to verify account. Please try again.' };
      } else {
        userRole = userData.role;
        logger.log('🔐 AuthContext: User found in users table with role:', userRole);
      }

      // Verify role matches
      if (userRole !== role) {
        logger.log('🔐 AuthContext: Role mismatch - expected:', role, 'found:', userRole);
        return { 
          success: false, 
          error: `This email is registered as a ${userRole}. Please use the ${userRole} forgot password page.` 
        };
      }

      // Send password reset using OTP instead of Magic Link
      // This should have better expiry control
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: false, // Don't create user if they don't exist
          emailRedirectTo: `${process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://fsas-frontend.vercel.app'}/reset-password?type=${role}`
        }
      });

      if (error) {
        logger.error('🔐 AuthContext: Password reset error:', error);
        return { success: false, error: error.message };
      }

      logger.log('✅ AuthContext: Password reset email sent successfully');
      return { success: true };
    } catch (error: unknown) {
      logger.error('🔐 AuthContext: Password reset error:', error);
      const message = error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
      return { success: false, error: message };
    }
  };

  const verifyOtp = async (otpCode: string) => {
    try {
      logger.log('🔐 AuthContext: ===== VERIFY OTP =====');
      logger.log('🔐 AuthContext: OTP Code:', otpCode);
      
      // Verify the OTP token
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: otpCode,
        type: 'email'
      });

      if (error) {
        logger.error('🔐 AuthContext: OTP verification error:', error);
        return { success: false, error: 'Invalid or expired verification code. Please try again.' };
      }

      logger.log('✅ AuthContext: OTP verified successfully');
      return { success: true, data };
    } catch (error) {
      logger.error('🔐 AuthContext: OTP verification error:', error);
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }
  };

  const updatePassword = async (otpCode: string, password: string, type: 'student' | 'professor') => {
    try {
      logger.log('🔐 AuthContext: ===== UPDATE PASSWORD =====');
      logger.log('🔐 AuthContext: OTP Code:', otpCode, 'Type:', type);
      
      // Validate password
      if (password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters long' };
      }

      // For OTP password reset, we need to verify the OTP token first
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: otpCode,
        type: 'email'
      });

      if (error) {
        logger.error('🔐 AuthContext: OTP verification error:', error);
        return { success: false, error: 'Invalid or expired verification code. Please try again.' };
      }

      // Now update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        logger.error('🔐 AuthContext: Password update error:', updateError);
        return { success: false, error: updateError.message };
      }

      logger.log('✅ AuthContext: Password updated successfully');
      return { success: true };
    } catch (error) {
      logger.error('🔐 AuthContext: Password update error:', error);
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }
  };

  const value = {
    user,
    userRole,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    verifyOtp,
    updatePassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
