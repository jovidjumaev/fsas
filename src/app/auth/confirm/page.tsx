'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';

function EmailConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired'>('loading');
  const [message, setMessage] = useState('');
  const [userType, setUserType] = useState<'student' | 'professor' | null>(null);

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        console.log('🔐 Email confirmation page loaded');
        
        // Get the token and type from URL parameters
        // Supabase might use different parameter names
        const token = searchParams.get('token') || 
                     searchParams.get('token_hash') || 
                     searchParams.get('confirmation_token') ||
                     searchParams.get('access_token') ||
                     searchParams.get('refresh_token');
        
        const type = searchParams.get('type') as 'student' | 'professor';
        
        if (type) {
          setUserType(type);
        }

        console.log('🔐 Email confirmation page loaded with params:', { token, type });
        console.log('🔐 Full URL:', window.location.href);
        console.log('🔐 Search params:', Object.fromEntries(searchParams.entries()));
        console.log('🔐 All available params:', Array.from(searchParams.keys()));

        // Check if we have a token in the URL
        if (!token) {
          console.error('❌ No confirmation token found in URL');
          console.log('🔐 Available search params:', Array.from(searchParams.keys()));
          console.log('🔐 This might be a direct link without token - checking if user is already confirmed');
          
          // Check if user is already signed in and confirmed
          const { data: { user } } = await supabase.auth.getUser();
          if (user && user.email_confirmed_at) {
            console.log('✅ User is already confirmed:', user.email);
            setStatus('success');
            setMessage('🎉 Your email is already confirmed! You can now sign in to your account.');
            return;
          }
          
          setStatus('error');
          setMessage('Invalid confirmation link. Please try registering again or check your email for the correct link.');
          return;
        }

        console.log('🔐 Confirming email with token...');
        
        // Try different confirmation methods
        let data, error;
        
        // Method 1: Try verifyOtp with token_hash
        const otpResult = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'email'
        });
        
        data = otpResult.data;
        error = otpResult.error;
        
        // Method 2: If that fails, try with the token directly
        if (error) {
          console.log('🔐 Trying alternative confirmation method...');
          const altResult = await supabase.auth.verifyOtp({
            token: token,
            type: 'email'
          });
          
          data = altResult.data;
          error = altResult.error;
        }

        if (error) {
          console.error('❌ Email confirmation error:', error);
          console.log('🔐 Error details:', {
            message: error.message,
            status: error.status,
            code: error.code
          });
          
          if (error.message.includes('expired') || error.message.includes('invalid')) {
            setStatus('expired');
            setMessage('This confirmation link has expired or is invalid. Please request a new confirmation email.');
          } else {
            setStatus('error');
            setMessage('Email confirmation failed. Please try again or contact support.');
          }
          return;
        }

        if (data?.user) {
          console.log('✅ Email confirmed successfully for user:', data.user.id);
          setStatus('success');
          setMessage('🎉 Congratulations! Your email has been confirmed successfully!\n\nYou can now sign in to your account and access all features.');
        } else {
          setStatus('error');
          setMessage('Email confirmation failed. Please try again.');
        }

      } catch (error) {
        console.error('❌ Email confirmation exception:', error);
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again or contact support.');
      }
    };

    confirmEmail();
  }, [searchParams, router]);

  const handleResendConfirmation = async () => {
    try {
      setStatus('loading');
      setMessage('Sending new confirmation email...');
      
      // This would require the user's email, which we don't have in this context
      // For now, redirect to registration page
      router.push(`/${userType || 'student'}/register`);
    } catch (error) {
      console.error('❌ Resend confirmation error:', error);
      setStatus('error');
      setMessage('Failed to resend confirmation email. Please try registering again.');
    }
  };

  const handleGoToLogin = () => {
    if (userType === 'student') {
      router.push('/student/login');
    } else if (userType === 'professor') {
      router.push('/professor/login');
    } else {
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            {status === 'loading' && <Loader2 className="h-6 w-6 animate-spin text-blue-600" />}
            {status === 'success' && <CheckCircle className="h-6 w-6 text-green-600" />}
            {status === 'error' && <XCircle className="h-6 w-6 text-red-600" />}
            {status === 'expired' && <Mail className="h-6 w-6 text-orange-600" />}
          </div>
          <CardTitle className="text-2xl font-bold">
            {status === 'loading' && 'Confirming Email...'}
            {status === 'success' && 'Email Confirmed!'}
            {status === 'error' && 'Confirmation Failed'}
            {status === 'expired' && 'Link Expired'}
          </CardTitle>
          <CardDescription>
            {status === 'loading' && 'Please wait while we confirm your email address.'}
            {status === 'success' && 'Your account is now active and ready to use.'}
            {status === 'error' && 'There was a problem confirming your email.'}
            {status === 'expired' && 'This confirmation link is no longer valid.'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="text-center text-sm text-gray-600">
            {message}
          </div>

          {status === 'success' && (
            <div className="space-y-3">
              <div className="text-center text-sm text-gray-500">
                Your account is now fully activated and ready to use!
              </div>
              <Button 
                onClick={() => window.location.href = 'https://fsas-frontend.vercel.app/'}
                className="w-full"
                variant="default"
              >
                Back to Home
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-3">
              <Button 
                onClick={() => router.push(`/${userType || 'student'}/register`)} 
                className="w-full"
                variant="default"
              >
                Try Registration Again
              </Button>
              <Button 
                onClick={() => window.location.href = 'https://fsas-frontend.vercel.app/'}
                className="w-full"
                variant="outline"
              >
                Back to Home
              </Button>
            </div>
          )}

          {status === 'expired' && (
            <div className="space-y-3">
              <Button 
                onClick={handleResendConfirmation} 
                className="w-full"
                variant="default"
              >
                Request New Confirmation Email
              </Button>
              <Button 
                onClick={() => window.location.href = 'https://fsas-frontend.vercel.app/'}
                className="w-full"
                variant="outline"
              >
                Back to Home
              </Button>
            </div>
          )}

          {status === 'loading' && (
            <div className="text-center">
              <div className="text-sm text-gray-500">
                This may take a few moments...
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function EmailConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
            <CardTitle>Loading...</CardTitle>
            <CardDescription>Please wait while we process your request.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    }>
      <EmailConfirmContent />
    </Suspense>
  );
}
