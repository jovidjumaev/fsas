'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/lib/auth-context';
import { createLogger } from '../../lib/logger';
const logger = createLogger('page');

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [selectedType, setSelectedType] = useState<'student' | 'professor' | null>(null);
  const [otpVerified, setOtpVerified] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  // Extract token from search params or hash
  const searchToken = searchParams.get('token') || 
                     searchParams.get('token_hash') || 
                     searchParams.get('access_token') ||
                     searchParams.get('refresh_token');
  
  // Also check hash parameters (Supabase puts tokens there after redirect)
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const hashToken = hashParams.get('token') || 
                   hashParams.get('token_hash') || 
                   hashParams.get('access_token') ||
                   hashParams.get('refresh_token');
  
  const token = searchToken || hashToken;
  
  // Debug: Check if we're getting tokens from Supabase redirect
  if (typeof window !== 'undefined') {
    logger.log('🔐 ResetPassword: Token extraction debug:', {
      searchParams: window.location.search,
      hash: window.location.hash,
      hashLength: window.location.hash.length,
      searchToken: searchToken ? 'found' : 'missing',
      hashToken: hashToken ? 'found' : 'missing',
      finalToken: token ? 'found' : 'missing',
      hashParams: Object.fromEntries(hashParams.entries()),
      fullUrl: window.location.href
    });
  }
  
  // Check for error parameters in hash FIRST
  const hashError = hashParams.get('error');
  const errorCode = hashParams.get('error_code');
  const errorDescription = hashParams.get('error_description');
  
  // Check if this is a direct access (no tokens) vs Supabase redirect
  if (typeof window !== 'undefined' && !token && !hashError && window.location.hash === '') {
    logger.log('🔐 ResetPassword: Direct access detected - no tokens or errors in URL');
  }
  
  const type = searchParams.get('type');
  const { verifyOtp, updatePassword } = useAuth();

  // OTP verification function
  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await verifyOtp(otpCode);
      
      if (result.success) {
        setOtpVerified(true);
        setError('');
      } else {
        setError(result.error || 'Invalid OTP code. Please try again.');
      }
    } catch (err) {
      setError('An error occurred while verifying the code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Add error boundary for debugging
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (e) => {
      logger.error('🔐 ResetPassword: Global error caught:', e.error);
    });
  }

  // Debug: Log all URL parameters
  if (typeof window !== 'undefined') {
    logger.log('🔐 ResetPassword: All URL parameters:', {
      search: window.location.search,
      hash: window.location.hash,
      pathname: window.location.pathname,
      href: window.location.href,
      searchToken: searchToken ? 'exists' : 'missing',
      hashToken: hashToken ? 'exists' : 'missing',
      finalToken: token ? 'exists' : 'missing'
    });
  }
  
  if (hashError) {
    logger.log('🔐 ResetPassword: Error detected in URL hash:', {
      hashError,
      errorCode,
      errorDescription
    });
  }

  // Check if this is a Supabase redirect without tokens (common issue)
  const isSupabaseRedirectWithoutTokens = typeof window !== 'undefined' && 
    window.location.hash === '' && 
    window.location.search.includes('type=') &&
    !token;
  
  if (isSupabaseRedirectWithoutTokens) {
    logger.log('🔐 ResetPassword: Supabase redirect detected but no tokens in URL hash');
    logger.log('🔐 ResetPassword: This indicates a Supabase configuration issue');
    logger.log('🔐 ResetPassword: Site URL and Redirect URLs need to be configured in Supabase dashboard');
  }

  useEffect(() => {
    logger.log('🔐 ResetPassword: useEffect triggered');
    logger.log('🔐 ResetPassword: Current state:', {
      isValidating,
      validationError,
      token: token ? 'exists' : 'missing',
      type: type,
      fullUrl: typeof window !== 'undefined' ? window.location.href : 'N/A',
      searchParams: typeof window !== 'undefined' ? window.location.search : 'N/A',
      hash: typeof window !== 'undefined' ? window.location.hash : 'N/A',
      hashError: hashError,
      errorCode: errorCode
    });

    // Prevent multiple executions if already processed
    if (!isValidating && validationError) {
      logger.log('🔐 ResetPassword: Already processed, skipping');
      return;
    }

    // Add a small delay to prevent flash of content
    const timeoutId = setTimeout(() => {
      // Check for error in URL hash first
      if (hashError) {
        logger.log('🔐 ResetPassword: Error detected, showing error message');
        let errorMessage = 'Invalid reset link. Please request a new password reset.';
        
        if (errorCode === 'otp_expired') {
          errorMessage = 'This password reset link has expired. Please request a new one.';
        } else if (errorCode === 'access_denied') {
          errorMessage = 'Access denied. This reset link is invalid or has been used already.';
        }
        
        setValidationError(errorMessage);
        setIsValidating(false);
        return;
      }

      // For OTP flow, we don't need a token - just check for valid type
      if (!token && type && (type === 'student' || type === 'professor')) {
        logger.log('🔐 ResetPassword: OTP flow detected - no token needed');
        setSelectedType(type);
        setIsValidating(false);
        return;
      }

      if (!token) {
        logger.log('🔐 ResetPassword: Missing token, showing error');
        logger.log('🔐 ResetPassword: This usually means Supabase did not redirect with tokens');
        logger.log('🔐 ResetPassword: Check Supabase Site URL and email template configuration');
        
        // Check if this is direct access
        const isDirectAccess = typeof window !== 'undefined' && !hashError && window.location.hash === '';
        
        let errorMessage = 'Invalid reset link. Please request a new password reset.';
        if (isDirectAccess) {
          errorMessage = 'Please use the password reset link from your email. Direct access to this page is not allowed.';
        } else if (isSupabaseRedirectWithoutTokens) {
          errorMessage = 'Password reset link is missing authentication tokens. This is a configuration issue with Supabase. Please contact support or try requesting a new password reset.';
        }
        
        setValidationError(errorMessage);
        setIsValidating(false);
        logger.log('🔐 ResetPassword: Error state set, isValidating set to false');
        return;
      }

      if (!type) {
        logger.log('🔐 ResetPassword: Missing type parameter, will show type selection');
        // Show type selection since Supabase doesn't preserve our custom parameters
        setIsValidating(false);
        return;
      }

      logger.log('🔐 ResetPassword: All checks passed, calling validateResetToken');
      // Validate the reset token
      validateResetToken();
    }, 100); // Small delay to prevent flash

    return () => clearTimeout(timeoutId);
  }, [token, type, hashError, errorCode]);

  // Fallback timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isValidating) {
        logger.log('🔐 ResetPassword: Timeout reached, forcing validation to complete');
        setIsValidating(false);
        if (!validationError) {
          setValidationError('Invalid reset link. Please request a new password reset.');
        }
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timeout);
  }, [isValidating, validationError]);

  const validateResetToken = async () => {
    try {
      logger.log('🔐 ResetPassword: Starting token validation...');
      // For Supabase password reset, we don't need to validate the token via API
      // The token will be validated when we try to update the password
      logger.log('🔐 ResetPassword: Token validation skipped - will validate during password update');
      logger.log('🔐 ResetPassword: Token exists:', !!token, 'Type:', type);
      logger.log('🔐 ResetPassword: Setting isValidating to false');
      setIsValidating(false);
      logger.log('🔐 ResetPassword: Token validation complete');
    } catch (err) {
      logger.error('Token validation error:', err);
      setValidationError('Failed to validate reset link. Please try again.');
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Validate passwords
      if (password.length < 6) {
        setError('Password must be at least 6 characters long');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      // Call password update function from auth context
      if (!otpCode) {
        setError('Invalid verification code');
        return;
      }
      const result = await updatePassword(otpCode, password, (type || selectedType) as 'student' | 'professor');

      if (result.success) {
        setIsSuccess(true);
      } else {
        setError(result.error || 'Failed to reset password. Please try again.');
      }
    } catch (err) {
      logger.error('Password reset error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <LoadingSpinner size="lg" text="Validating reset link..." />
          </div>
        </div>
      </div>
    );
  }

  // Show type selection if token exists but type is missing
  if (!type && token && !validationError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <Link href="/" className="inline-block">
              <h1 className="text-3xl font-bold text-gray-900">FSAS</h1>
              <p className="text-sm text-gray-500">Furman Smart Attendance System</p>
            </Link>
          </div>

          <Card className="p-8">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Select Account Type
              </h2>
              
              <p className="text-gray-600 mb-6">
                Please select your account type to continue with password reset:
              </p>
              
              <div className="space-y-4">
                <Button 
                  onClick={() => setSelectedType('student')}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  🎓 I'm a Student
                </Button>
                
                <Button 
                  onClick={() => setSelectedType('professor')}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  👨‍🏫 I'm a Professor
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (validationError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <Link href="/" className="inline-block">
              <h1 className="text-3xl font-bold text-gray-900">FSAS</h1>
              <p className="text-sm text-gray-500">Furman Smart Attendance System</p>
            </Link>
          </div>

          <Card className="p-8">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Invalid Reset Link
              </h2>
              
              <p className="text-gray-600 mb-6">
                {validationError}
              </p>
              
              <div className="space-y-4">
                <Button 
                  onClick={() => window.location.href = 'https://fsas-frontend.vercel.app/'}
                  className="w-full"
                >
                  Back to Homepage
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <Link href="/" className="inline-block">
              <h1 className="text-3xl font-bold text-gray-900">FSAS</h1>
              <p className="text-sm text-gray-500">Furman Smart Attendance System</p>
            </Link>
          </div>

          <Card className="p-8">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Password Reset Successful
              </h2>
              
              <p className="text-gray-600 mb-6">
                Your password has been successfully reset. You can now sign in with your new password.
              </p>
              
              <Button 
                onClick={() => window.location.href = 'https://fsas-frontend.vercel.app/'}
                className="w-full"
              >
                Back to Homepage
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Show OTP input form if not verified yet
  if (!otpVerified && selectedType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {/* Header */}
          <div className="text-center">
            <Link href="/" className="inline-block">
              <h1 className="text-3xl font-bold text-gray-900">FSAS</h1>
              <p className="text-sm text-gray-500">Furman Smart Attendance System</p>
            </Link>
            <h2 className="mt-6 text-2xl font-bold text-gray-900">
              Enter Verification Code
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Please enter the 6-digit code sent to your email.
            </p>
          </div>

          {/* OTP Form */}
          <Card className="p-8">
            <form onSubmit={(e) => { e.preventDefault(); handleVerifyOtp(); }} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="otpCode" className="block text-sm font-medium text-gray-700">
                  Verification Code
                </label>
                <Input
                  id="otpCode"
                  type="text"
                  required
                  value={otpCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtpCode(value);
                  }}
                  className="mt-1 text-center text-2xl tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Enter the 6-digit code from your email
                </p>
              </div>

              <Button
                type="submit"
                disabled={isLoading || otpCode.length !== 6}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <LoadingSpinner size="sm" className="mr-2" />
                    Verifying Code...
                  </div>
                ) : (
                  'Verify Code'
                )}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-bold text-gray-900">FSAS</h1>
            <p className="text-sm text-gray-500">Furman Smart Attendance System</p>
          </Link>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">
            Set New Password
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your new password below.
          </p>
        </div>

        {/* Reset Password Form */}
        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                New Password
              </label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
                placeholder="Enter new password"
              />
              <p className="mt-1 text-xs text-gray-500">
                Password must be at least 6 characters long
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm New Password
              </label>
              <Input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1"
                placeholder="Confirm new password"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <LoadingSpinner size="sm" className="mr-2" />
                  Resetting Password...
                </div>
              ) : (
                'Reset Password'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button 
              variant="ghost" 
              onClick={() => window.location.href = 'https://fsas-frontend.vercel.app/'}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              ← Back to Homepage
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function ResetPassword() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <LoadingSpinner size="lg" text="Loading..." />
          </div>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
