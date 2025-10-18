'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';

export default function EmailConfirmPage() {
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
        const token = searchParams.get('token');
        const type = searchParams.get('type') as 'student' | 'professor';
        
        if (type) {
          setUserType(type);
        }

        if (!token) {
          console.error('❌ No confirmation token found');
          setStatus('error');
          setMessage('Invalid confirmation link. Please try registering again.');
          return;
        }

        console.log('🔐 Confirming email with token...');
        
        // Confirm the email using Supabase
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'email'
        });

        if (error) {
          console.error('❌ Email confirmation error:', error);
          
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
                onClick={handleGoToLogin} 
                className="w-full"
                variant="default"
              >
                Go to Sign In
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
                onClick={handleGoToLogin} 
                className="w-full"
                variant="outline"
              >
                Go to Login
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
                onClick={handleGoToLogin} 
                className="w-full"
                variant="outline"
              >
                Go to Login
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
