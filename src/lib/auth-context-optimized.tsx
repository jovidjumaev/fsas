'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { authLogger as logger } from './logger';

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

// Lazy load heavy dependencies
const loadAuthDependencies = async () => {
  const [
    { parseSupabaseError, logDetailedError, testDatabaseConnection, validateRequiredFields, formatErrorForUser },
    { supabaseAdmin }
  ] = await Promise.all([
    import('./error-handler'),
    import('./supabase')
  ]);

  return {
    parseSupabaseError,
    logDetailedError,
    testDatabaseConnection,
    validateRequiredFields,
    formatErrorForUser,
    supabaseAdmin
  };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'student' | 'professor' | null>(null);
  const [loading, setLoading] = useState(true);

  // Optimized initialization - faster timeout, simpler logic
  useEffect(() => {
    let mounted = true;

    // Fast initialization with 1 second timeout
    const timeoutId = setTimeout(() => {
      if (mounted && loading) {
        logger.warn('Auth initialization timeout - setting to ready');
        setLoading(false);
      }
    }, 1000); // Reduced from 5 seconds to 1 second

    const initAuth = async () => {
      try {
        // Get cached session first (instant)
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          setUser(session.user);
          // Get role from user metadata first (instant)
          const metadataRole = session.user.user_metadata?.role;
          if (metadataRole) {
            setUserRole(metadataRole as 'student' | 'professor');
          } else {
            // Only fetch from database if not in metadata
            fetchUserRole(session.user.id);
          }
        }
      } catch (error) {
        logger.error('Auth initialization error:', error);
      } finally {
        if (mounted) {
          clearTimeout(timeoutId);
          setLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          const metadataRole = session.user.user_metadata?.role;
          if (metadataRole) {
            setUserRole(metadataRole as 'student' | 'professor');
          } else {
            await fetchUserRole(session.user.id);
          }
        } else {
          setUser(null);
          setUserRole(null);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserRole = useCallback(async (userId: string) => {
    try {
      // Quick role fetch with short timeout
      const rolePromise = supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Role fetch timeout')), 3000)
      );

      const { data } = await Promise.race([rolePromise, timeoutPromise]) as any;

      if (data?.role) {
        setUserRole(data.role as 'student' | 'professor');
      }
    } catch (error) {
      logger.debug('Role fetch error (non-critical):', error);
      // Don't block on role fetch errors
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string, role: 'student' | 'professor') => {
    try {
      // Basic validation
      if (!email || !password) {
        return { success: false, error: 'Please provide both email and password' };
      }

      // Sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Check email confirmation
      if (data.user && !data.user.email_confirmed_at) {
        return {
          success: false,
          error: 'Please check your email and click the confirmation link before signing in.'
        };
      }

      if (data.user) {
        // Verify role
        const userRole = data.user.user_metadata?.role;
        if (userRole && userRole !== role) {
          await supabase.auth.signOut();
          return {
            success: false,
            error: `This account is registered as a ${userRole}. Please use the ${userRole} login page.`
          };
        }

        setUser(data.user);
        setUserRole(role);
        return { success: true };
      }

      return { success: false, error: 'Sign in failed' };
    } catch (error: any) {
      return { success: false, error: error?.message || 'An unexpected error occurred' };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, role: 'student' | 'professor', additionalData: any) => {
    try {
      // Lazy load dependencies for signup
      const deps = await loadAuthDependencies();

      // Validate required fields
      const requiredFields = ['firstName', 'lastName'];
      if (role === 'student') {
        requiredFields.push('studentNumber');
      } else {
        requiredFields.push('employeeId');
      }

      const validation = deps.validateRequiredFields(additionalData, requiredFields);
      if (!validation.valid) {
        return { success: false, error: validation.message || 'Please fill in all required fields' };
      }

      // Create auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: additionalData.firstName,
            last_name: additionalData.lastName,
            role: role
          },
          emailRedirectTo: `${window.location.origin}/auth/confirm?type=${role}`
        }
      });

      if (signUpError) {
        return { success: false, error: signUpError.message };
      }

      if (!authData.user) {
        return { success: false, error: 'Account creation failed' };
      }

      if (!authData.user.email_confirmed_at) {
        return {
          success: true,
          requiresEmailConfirmation: true,
          message: `Account created successfully! Please check your email (${email}) and click the confirmation link.`
        };
      }

      setUser(authData.user);
      setUserRole(role);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      return { success: false, error: message };
    }
  }, []);

  const signOut = useCallback(async () => {
    const currentUserRole = userRole;
    try {
      await supabase.auth.signOut();
      setUser(null);
      setUserRole(null);

      if (typeof window !== 'undefined') {
        const redirectPath = currentUserRole === 'professor' ? '/professor/login' : '/student/login';
        window.location.href = redirectPath;
      }
    } catch (error) {
      logger.error('Sign out error:', error);
      setUser(null);
      setUserRole(null);
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  }, [userRole]);

  const resetPassword = useCallback(async (email: string, role: 'student' | 'professor') => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password?type=${role}`
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      return { success: false, error: message };
    }
  }, []);

  const updatePassword = useCallback(async (otpCode: string, password: string) => {
    try {
      if (password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters long' };
      }

      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: otpCode,
        type: 'email'
      });

      if (error) {
        return { success: false, error: 'Invalid or expired verification code' };
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, []);

  const value = {
    user,
    userRole,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}