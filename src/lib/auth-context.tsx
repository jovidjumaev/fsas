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
    console.log('🔐 AuthContext: Initializing...');
    console.log('🔐 AuthContext: Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('🔐 AuthContext: Supabase Key exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    
    // Timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.warn('⚠️ AuthContext: Initialization timeout - forcing loading to false');
      setLoading(false);
    }, 5000); // 5 second timeout
    
    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('🔐 AuthContext: Getting initial session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ AuthContext: Session error:', error);
        } else {
          console.log('🔐 AuthContext: Session result:', { 
            hasSession: !!session, 
            hasUser: !!session?.user,
            userId: session?.user?.id 
          });
        }
        
        if (session?.user) {
          console.log('🔐 AuthContext: User found, fetching role...');
          setUser(session.user);
          await fetchUserRole(session.user.id);
        } else {
          console.log('🔐 AuthContext: No user in session');
        }
      } catch (error) {
        console.error('❌ AuthContext: Initial session error:', error);
      } finally {
        clearTimeout(timeoutId);
        console.log('🔐 AuthContext: Setting loading to false');
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    console.log('🔐 AuthContext: Setting up auth state listener...');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 AuthContext: Auth state changed:', { event, hasSession: !!session, hasUser: !!session?.user });
        
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
      console.log('🔐 AuthContext: Cleaning up auth listener');
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserRole = async (userId: string, retryCount = 0) => {
    try {
      console.log('🔐 Fetching user role for:', userId, retryCount > 0 ? `(retry ${retryCount})` : '');
      
      // Add timeout to prevent hanging - increased from 3s to 15s for better stability
      const rolePromise = supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();
      
      const timeoutPromise = new Promise((unused, reject) => 
        setTimeout(() => reject(new Error('Role fetch timeout')), 15000) // Increased to 15 seconds
      );
      
      const { data: userData, error: userError } = await Promise.race([
        rolePromise,
        timeoutPromise
      ]) as any;

      if (userError) {
        console.error('Error fetching user role:', userError);
        
        // Retry logic for temporary failures - reduced retries to prevent loops
        if (retryCount < 1 && (userError.message?.includes('timeout') || userError.message?.includes('network'))) {
          console.log('🔐 Retrying role fetch in 2 seconds...');
          setTimeout(() => fetchUserRole(userId, retryCount + 1), 2000);
          return;
        }
        
        console.log('🔐 Attempting fallback role detection...');
        
        // Fallback: Check if users table exists but couldn't find user
        console.log('🔐 Could not fetch role from users table');
        // No additional fallback needed - users is the main table
        
        // Don't set userRole to null on failure - keep existing role to prevent UI issues
        console.log('🔐 Keeping existing role to prevent UI disruption');
        return;
      }

      if (userData?.role) {
        console.log('🔐 Found role:', userData.role);
        setUserRole(userData.role as 'student' | 'professor');
        return;
      }

      console.warn('🔐 No role found for user');
      // Don't set to null - keep existing role
      console.log('🔐 Keeping existing role to prevent UI disruption');
    } catch (error) {
      console.error('Error fetching user role:', error);
      
      // Retry logic for timeout errors - reduced retries
      if (retryCount < 1 && error.message?.includes('timeout')) {
        console.log('🔐 Retrying role fetch after timeout...');
        setTimeout(() => fetchUserRole(userId, retryCount + 1), 2000);
        return;
      }
      
      // Don't set userRole to null on failure - keep existing role
      console.log('🔐 Keeping existing role to prevent UI disruption');
    }
  };

  const signIn = async (email: string, password: string, role: 'student' | 'professor') => {
    try {
      console.log('🔐 AuthContext: ===== SIGN-IN PROCESS STARTED =====');
      console.log('🔐 AuthContext: Input parameters:', { 
        email, 
        role, 
        passwordLength: password?.length || 0,
        passwordProvided: !!password
      });
      console.log('🔐 AuthContext: Environment check:', {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseKeyExists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        supabaseKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0
      });
      console.log('🔐 AuthContext: Current state:', { 
        user: !!user, 
        userRole,
        loading
      });
      
      // Validate input
      if (!email || !password) {
        console.error('❌ AuthContext: VALIDATION FAILED - Missing credentials');
        console.error('❌ AuthContext: Email provided:', !!email);
        console.error('❌ AuthContext: Password provided:', !!password);
        return { success: false, error: 'Please provide both email and password' };
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        console.error('❌ AuthContext: VALIDATION FAILED - Invalid email format');
        return { success: false, error: 'Please enter a valid email address' };
      }

      // Validate password length
      if (password.length < 6) {
        console.error('❌ AuthContext: VALIDATION FAILED - Password too short');
        return { success: false, error: 'Password must be at least 6 characters long' };
      }
      
      console.log('🔐 AuthContext: Input validation passed');
      console.log('🔐 AuthContext: Attempting Supabase authentication...');
      console.log('🔐 AuthContext: Start time:', new Date().toISOString());
      
      // Sign in without timeout - let Supabase handle it
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      
      console.log('🔐 AuthContext: Auth completed at:', new Date().toISOString());

      console.log('🔐 AuthContext: ===== SUPABASE AUTH RESPONSE =====');
      console.log('🔐 AuthContext: Response data:', {
        hasData: !!data,
        hasUser: !!data?.user,
        hasSession: !!data?.session,
        userId: data?.user?.id,
        userEmail: data?.user?.email,
        userEmailConfirmed: data?.user?.email_confirmed_at ? 'YES' : 'NO',
        userCreatedAt: data?.user?.created_at,
        userLastSignIn: data?.user?.last_sign_in_at
      });
      console.log('🔐 AuthContext: Response error:', {
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
        console.log('🔐 AuthContext: Email not confirmed, blocking sign-in');
        return {
          success: false,
          error: 'Please check your email and click the confirmation link before signing in.\n\n📧 Check your spam folder if you don\'t see the confirmation email.'
        };
      }

      if (data.user) {
        console.log('✅ AuthContext: ===== AUTHENTICATION SUCCESSFUL =====');
        console.log('✅ AuthContext: User authenticated successfully');
        console.log('🔐 AuthContext: User details:', {
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
        console.log('🔍 AuthContext: ===== CHECKING USER PROFILE =====');
        console.log('🔍 AuthContext: Using user metadata instead of database query');
        console.log('🔍 AuthContext: User metadata:', data.user.user_metadata);
        console.log('🔍 AuthContext: Expected role:', role);
        
        // Get role from user metadata (set during registration)
        const userMetadata = data.user.user_metadata || {};
        const userRole = userMetadata.role;
        
        console.log('🔍 AuthContext: Role from metadata:', userRole);
        
        // Verify role matches what was expected
        if (userRole !== role) {
          console.error('❌ AuthContext: Role mismatch');
          console.log('Expected:', role, 'Got:', userRole);
          await supabase.auth.signOut();
          return {
            success: false,
            error: `This account is registered as a ${userRole}. Please use the ${userRole} login page instead.`
          };
        }
        
        console.log('✅ AuthContext: Role verified from metadata');

        console.log('✅ AuthContext: ===== ROLE VERIFICATION PASSED =====');
        console.log('✅ AuthContext: Role verified successfully');
        console.log('✅ AuthContext: Welcome', data.user.email, `(${role})`);
        
        // Set user and role state
        console.log('🔐 AuthContext: ===== UPDATING STATE =====');
        setUser(data.user);
        setUserRole(role);
        
        console.log('🔐 AuthContext: State updated successfully:', { 
          user: !!data.user, 
          userRole: role,
          userId: data.user.id,
          userEmail: data.user.email
        });
        
        console.log('🎉 AuthContext: ===== SIGN-IN COMPLETED SUCCESSFULLY =====');
        return { success: true };
      }

      console.error('❌ AuthContext: ===== NO USER RETURNED =====');
      console.error('❌ AuthContext: Authentication succeeded but no user object returned');
      return { success: false, error: 'Sign in failed - no user data returned' };
    } catch (error: any) {
      console.error('❌ AuthContext: ===== UNEXPECTED ERROR =====');
      console.error('❌ AuthContext: Error type:', typeof error);
      console.error('❌ AuthContext: Error message:', error?.message);
      console.error('❌ AuthContext: Error code:', error?.code);
      console.error('❌ AuthContext: Error name:', error?.name);
      console.error('❌ AuthContext: Full error object:', error);
      
      return { 
        success: false, 
        error: error?.message || 'An unexpected error occurred. Please try again.' 
      };
    }
  };

  const signUp = async (email: string, password: string, role: 'student' | 'professor', additionalData: any) => {
    try {
      console.log('🚀 AuthContext: Starting signUp process');
      console.log('📧 Email:', email);
      console.log('👤 Role:', role);
      console.log('📝 Additional Data:', {
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
        console.error('❌ Required fields validation failed:', validation.missingFields);
        return {
          success: false,
          error: validation.message || 'Please fill in all required fields'
        };
      }

      // Validate student ID format (exactly 7 digits)
      if (role === 'student') {
        const studentNumberRegex = /^\d{7}$/;
        if (!studentNumberRegex.test(additionalData.studentNumber?.trim() || '')) {
          console.error('❌ Invalid student ID format:', additionalData.studentNumber);
          return {
            success: false,
            error: 'Student ID must be exactly 7 digits.\n\n💡 Example: 5002378\n\nPlease enter your official university student ID number.'
          };
        }
        console.log('✅ Student ID format validated:', additionalData.studentNumber);
        
        // Validate student ID uniqueness
        console.log('🎓 ===== STUDENT ID UNIQUENESS VALIDATION START =====');
        console.log('🎓 Validating student ID uniqueness...');
        
        try {
          const { validateStudentIdUniqueness } = await import('./student-id-uniqueness-validator');
          console.log('🎓 Import successful');
          
          const studentIdUniquenessValidation = await validateStudentIdUniqueness(additionalData.studentNumber);
          console.log('🎓 Validation result:', studentIdUniquenessValidation);
          
          if (!studentIdUniquenessValidation.isUnique) {
            console.error('❌ Student ID uniqueness validation failed:', studentIdUniquenessValidation.error);
            return {
              success: false,
              error: studentIdUniquenessValidation.error || 'Student ID is not unique'
            };
          }
          
          console.log('✅ Student ID uniqueness validation passed');
        } catch (validationError) {
          console.error('❌ Error during student ID validation:', validationError);
          return {
            success: false,
            error: 'Student ID validation failed. Please try again.'
          };
        }
      }

      // Validate employee ID format and uniqueness (for professors)
      if (role === 'professor') {
        console.log('👨‍🏫 ===== EMPLOYEE ID VALIDATION START =====');
        console.log('👨‍🏫 Validating employee ID format and uniqueness...');
        
        // Basic format validation
        if (!additionalData.employeeId || additionalData.employeeId.trim().length !== 7) {
          console.error('❌ Invalid employee ID format:', additionalData.employeeId);
          return {
            success: false,
            error: 'Employee ID must be exactly 7 digits.\n\n💡 Example: 1234567\n\nPlease enter your official employee ID number.'
          };
        }
        
        // Format validation (exactly 7 digits)
        const employeeIdRegex = /^\d{7}$/;
        if (!employeeIdRegex.test(additionalData.employeeId.trim())) {
          console.error('❌ Invalid employee ID format:', additionalData.employeeId);
          return {
            success: false,
            error: 'Employee ID must be exactly 7 digits.\n\n💡 Example: 1234567\n\nPlease enter your official employee ID number.'
          };
        }
        console.log('✅ Employee ID format validated:', additionalData.employeeId);
        
        // Validate employee ID uniqueness
        console.log('👨‍🏫 Validating employee ID uniqueness...');
        
        try {
          const { validateEmployeeIdUniqueness } = await import('./employee-id-uniqueness-validator');
          console.log('👨‍🏫 Import successful');
          
          const employeeIdValidation = await validateEmployeeIdUniqueness(additionalData.employeeId);
          console.log('👨‍🏫 Validation result:', employeeIdValidation);
          
          if (!employeeIdValidation.isUnique) {
            console.error('❌ Employee ID uniqueness validation failed:', employeeIdValidation.error);
            return {
              success: false,
              error: employeeIdValidation.error || 'Employee ID is not unique'
            };
          }
          
          console.log('✅ Employee ID uniqueness validation passed');
        } catch (validationError) {
          console.error('❌ Error during employee ID validation:', validationError);
          return {
            success: false,
            error: 'Employee ID validation failed. Please try again.'
          };
        }
      }
      
      // Test database connection first
      console.log('🔍 Testing database connection...');
      const dbTest = await testDatabaseConnection(supabase);
      if (dbTest) {
        console.error('❌ Database connection test failed');
        return {
          success: false,
          error: formatErrorForUser(dbTest)
        };
      }
      console.log('✅ Database connection successful');
      
      // Validate password strength
      console.log('🔐 Validating password strength...');
      const { validatePassword } = await import('./password-validator');
      const passwordValidation = validatePassword(password);
      
      if (!passwordValidation.isValid) {
        console.error('❌ Password validation failed:', passwordValidation.errors);
        return { 
          success: false, 
          error: passwordValidation.errors[0] || 'Password does not meet security requirements' 
        };
      }
      
      if (!passwordValidation.strength.isValid) {
        console.error('❌ Password strength insufficient');
        return { 
          success: false, 
          error: 'Password is not strong enough. Please create a more secure password.' 
        };
      }
      
      console.log('✅ Password validation passed');
      
      // Validate email domain and uniqueness (only allow @furman.edu and must be unique)
      console.log('📧 ===== EMAIL VALIDATION START =====');
      console.log('📧 Validating email domain and uniqueness...');
      
      // Check email domain
      if (!email.endsWith('@furman.edu')) {
        console.error('❌ Email domain validation failed');
        return {
          success: false,
          error: 'Only @furman.edu email addresses are allowed for registration.\n\n💡 Please use your official Furman University email address.'
        };
      }
      
      // Check if email already exists in users table
      console.log('🔍 Checking if email already exists in users table...');
      const { data: existingUser, error: userCheckError } = await supabase
        .from('users')
        .select('id, role, first_name, last_name')
        .eq('email', email.toLowerCase())
        .single();
      
      if (userCheckError && userCheckError.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('❌ Error checking users table:', userCheckError);
        return {
          success: false,
          error: 'Unable to verify email availability. Please try again or contact support.'
        };
      }
      
      if (existingUser) {
        console.error('❌ Email already exists in users table:', existingUser.id);
        return {
          success: false,
          error: `This email is already registered as a ${existingUser.role}.\n\n💡 Please sign in instead:\n   • Go to /${existingUser.role}/login\n   • Use your email and password\n   • Or click "Forgot Password" if needed`
        };
      }
      
      console.log('✅ Email validation passed');
      
      // Validate password uniqueness
      console.log('🔐 ===== PASSWORD UNIQUENESS VALIDATION START =====');
      console.log('🔐 Password to validate:', password);
      console.log('🔐 Validating password uniqueness...');
      
      try {
        const { validatePasswordUniqueness, validatePasswordPersonalInfo } = await import('./password-uniqueness-validator');
        console.log('🔐 Import successful');
        
        const passwordUniquenessValidation = await validatePasswordUniqueness(password);
        console.log('🔐 Validation result:', passwordUniquenessValidation);
        
        if (!passwordUniquenessValidation.isUnique) {
          console.error('❌ Password uniqueness validation failed:', passwordUniquenessValidation.error);
          return {
            success: false,
            error: passwordUniquenessValidation.error || 'Password is not unique'
          };
        }
        
        console.log('✅ Password uniqueness validation passed');
        
        // Check if password contains personal information
        const personalInfoValidation = validatePasswordPersonalInfo(password, {
          firstName: additionalData.firstName,
          lastName: additionalData.lastName,
          email: email,
          studentNumber: additionalData.studentNumber,
          employeeId: additionalData.employeeId
        });
        
        if (!personalInfoValidation.isUnique) {
          console.error('❌ Password personal info validation failed:', personalInfoValidation.error);
          return {
            success: false,
            error: personalInfoValidation.error || 'Password contains personal information'
          };
        }
        
        console.log('✅ Password personal info validation passed');
      } catch (validationError) {
        console.error('❌ Error during password validation:', validationError);
        return {
          success: false,
          error: 'Password validation failed. Please try again.'
        };
      }
      
      // Email uniqueness already validated above, proceeding with registration
      console.log('✅ Email is available, proceeding with registration...');
      
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

      console.log('AuthContext: Supabase auth response', { authData, signUpError });

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
        console.error('AuthContext: No user created');
        return { 
          success: false, 
          error: 'Account creation failed. No user data returned.\n\n💡 Please try again or contact support if this persists.' 
        };
      }

      // Check if email confirmation is required for new users
      if (!authData.user.email_confirmed_at) {
        console.log('AuthContext: Email confirmation required for new user');
        return {
          success: true,
          requiresEmailConfirmation: true,
          message: `Account created successfully! Please check your email (${email}) and click the confirmation link to activate your account.\n\n📧 Check your spam folder if you don't see the email.`
        };
      }

      // Wait for the trigger to create the user profile, then verify it exists
      console.log('AuthContext: Waiting for user profile creation...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if user profile was created by trigger
      const { data: userProfile, error: userProfileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (userProfileError || !userProfile) {
        console.log('AuthContext: User profile not created by trigger, creating manually...');
        
        // Create user profile manually using admin client to bypass RLS
        const { error: userError } = await supabaseAdmin
          .from('users')
          .insert({
            id: authData.user.id,
            email: email,
            first_name: additionalData.firstName,
            last_name: additionalData.lastName,
            role: role
          });

        if (userError) {
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

      // Create role-specific data
      if (role === 'student') {
        const { error: studentError } = await supabaseAdmin
          .from('students')
          .insert({
            user_id: authData.user.id,
            student_id: additionalData.studentNumber,
            enrollment_year: new Date().getFullYear(),
            major: additionalData.major || 'Computer Science'
          });

        if (studentError) {
          console.error('Failed to create student record:', studentError);
          // Don't fail registration for this, just log it
        }
      } else if (role === 'professor') {
        const { error: professorError } = await supabaseAdmin
          .from('professors')
          .insert({
            user_id: authData.user.id,
            employee_id: additionalData.employeeId,
            title: additionalData.title || 'Professor',
            office_location: additionalData.office_location || '',
            phone: additionalData.phone || ''
          });

        if (professorError) {
          console.error('Failed to create professor record:', professorError);
          // Don't fail registration for this, just log it
        }
      }

      console.log('✅ User profile created with role:', role);

      // Record password hash for uniqueness tracking
      console.log('📝 Recording password hash for uniqueness tracking...');
      const { recordPasswordHash } = await import('./password-uniqueness-validator');
      await recordPasswordHash(authData.user.id, password);

      // Record student ID hash for uniqueness tracking (if student)
      if (role === 'student' && additionalData.studentNumber) {
        console.log('📝 Recording student ID hash for uniqueness tracking...');
        const { recordStudentIdHash } = await import('./student-id-uniqueness-validator');
        await recordStudentIdHash(authData.user.id, additionalData.studentNumber);
      }

      // Record employee ID hash for uniqueness tracking (if professor)
      if (role === 'professor' && additionalData.employeeId) {
        console.log('📝 Recording employee ID hash for uniqueness tracking...');
        const { recordEmployeeIdHash } = await import('./employee-id-uniqueness-validator');
        await recordEmployeeIdHash(authData.user.id, additionalData.employeeId);
      }

      setUser(authData.user);
      setUserRole(role);
      return { success: true };
    } catch (error) {
      console.error('Sign up error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  };

  const signOut = async () => {
    console.log('🔐 AuthContext: Starting sign out process...');
    
    // Store the current user role before clearing it
    const currentUserRole = userRole;
    
    try {
      await supabase.auth.signOut();
      console.log('🔐 AuthContext: Supabase sign out completed');
      setUser(null);
      setUserRole(null);
      console.log('🔐 AuthContext: User state cleared');
      
      // Redirect to appropriate login page based on user role
      if (typeof window !== 'undefined') {
        if (currentUserRole === 'student') {
          console.log('🔐 AuthContext: Redirecting to student login page');
          window.location.href = '/student/login';
        } else if (currentUserRole === 'professor') {
          console.log('🔐 AuthContext: Redirecting to professor login page');
          window.location.href = '/professor/login';
        } else {
          console.log('🔐 AuthContext: No role detected, redirecting to main page');
          window.location.href = '/';
        }
      }
    } catch (error) {
      console.error('🔐 AuthContext: Sign out error:', error);
      // Even if there's an error, clear the local state
      setUser(null);
      setUserRole(null);
      
      // Force navigation to appropriate login page even on error
      if (typeof window !== 'undefined') {
        if (currentUserRole === 'student') {
          console.log('🔐 AuthContext: Error occurred, redirecting to student login page');
          window.location.href = '/student/login';
        } else if (currentUserRole === 'professor') {
          console.log('🔐 AuthContext: Error occurred, redirecting to professor login page');
          window.location.href = '/professor/login';
        } else {
          console.log('🔐 AuthContext: Error occurred, no role detected, redirecting to main page');
          window.location.href = '/';
        }
      }
    }
  };

  const resetPassword = async (email: string, role: 'student' | 'professor') => {
    try {
      console.log('🔐 AuthContext: ===== PASSWORD RESET REQUEST =====');
      console.log('🔐 AuthContext: Email:', email, 'Role:', role);
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { success: false, error: 'Please enter a valid email address' };
      }

      // Simplified approach: Check users table first, then try password reset
      console.log('🔐 AuthContext: Checking users table for user...');
      
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('id, email, role')
        .eq('email', email.trim().toLowerCase())
        .single();

      let userRole = null;
      
      if (userError && userError.code === 'PGRST116') {
        // User not found in users table - assume they exist in Auth and use provided role
        console.log('🔐 AuthContext: User not found in users table, using provided role:', role);
        userRole = role;
      } else if (userError) {
        console.error('🔐 AuthContext: Error querying users table:', userError);
        return { success: false, error: 'Unable to verify account. Please try again.' };
      } else {
        userRole = userData.role;
        console.log('🔐 AuthContext: User found in users table with role:', userRole);
      }

      // Verify role matches
      if (userRole !== role) {
        console.log('🔐 AuthContext: Role mismatch - expected:', role, 'found:', userRole);
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
        console.error('🔐 AuthContext: Password reset error:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ AuthContext: Password reset email sent successfully');
      return { success: true };
    } catch (error) {
      console.error('🔐 AuthContext: Password reset error:', error);
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }
  };

  const verifyOtp = async (otpCode: string) => {
    try {
      console.log('🔐 AuthContext: ===== VERIFY OTP =====');
      console.log('🔐 AuthContext: OTP Code:', otpCode);
      
      // Verify the OTP token
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: otpCode,
        type: 'email'
      });

      if (error) {
        console.error('🔐 AuthContext: OTP verification error:', error);
        return { success: false, error: 'Invalid or expired verification code. Please try again.' };
      }

      console.log('✅ AuthContext: OTP verified successfully');
      return { success: true, data };
    } catch (error) {
      console.error('🔐 AuthContext: OTP verification error:', error);
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }
  };

  const updatePassword = async (otpCode: string, password: string, type: 'student' | 'professor') => {
    try {
      console.log('🔐 AuthContext: ===== UPDATE PASSWORD =====');
      console.log('🔐 AuthContext: OTP Code:', otpCode, 'Type:', type);
      
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
        console.error('🔐 AuthContext: OTP verification error:', error);
        return { success: false, error: 'Invalid or expired verification code. Please try again.' };
      }

      // Now update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        console.error('🔐 AuthContext: Password update error:', updateError);
        return { success: false, error: updateError.message };
      }

      console.log('✅ AuthContext: Password updated successfully');
      return { success: true };
    } catch (error) {
      console.error('🔐 AuthContext: Password update error:', error);
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
