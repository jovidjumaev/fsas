'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { Mail, ArrowLeft, CheckCircle, Moon, Sun, Zap, BookOpen } from 'lucide-react';
import { ErrorDisplay } from '@/components/ui/error-display';
import { createLogger } from '../../../lib/logger';
const logger = createLogger('page');

export default function ProfessorForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { resetPassword } = useAuth();

  // Dark mode setup
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode') === 'true';
    setIsDarkMode(savedMode);
    if (savedMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('darkMode', String(newMode));
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError('Please enter a valid email address');
        return;
      }

      // Call password reset function from auth context
      const result = await resetPassword(email.trim().toLowerCase(), 'professor');

      if (result.success) {
        setIsSubmitted(true);
      } else {
        setError(result.error || 'Failed to send reset email. Please try again.');
      }
    } catch (err) {
      logger.error('Password reset error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-200 via-gray-200 to-slate-100 dark:from-gray-900 dark:via-cyan-900 dark:to-teal-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-400 dark:bg-cyan-600 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-400 dark:bg-emerald-600 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-teal-400 dark:bg-teal-600 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>

        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="absolute top-6 right-6 p-3 rounded-xl bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all duration-300 z-10"
        >
          {isDarkMode ? (
            <Sun className="w-5 h-5 text-yellow-500" />
          ) : (
            <Moon className="w-5 h-5 text-gray-700" />
          )}
        </button>

        <div className="max-w-md w-full space-y-8 relative z-10">
          {/* Header */}
          <div className="text-center">
            <Link href="/" className="inline-block group">
              <div className="flex items-center justify-center space-x-3 mb-2">
                <div className="relative">
                  <Zap className="w-10 h-10 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform" />
                  <div className="absolute inset-0 bg-cyan-400 dark:bg-cyan-600 blur-xl opacity-50"></div>
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-600 to-teal-600 dark:from-cyan-400 dark:to-teal-400 bg-clip-text text-transparent">
                  FSAS
                </h1>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Furman Smart Attendance System</p>
            </Link>
          </div>

          {/* Success Card */}
          <Card className="relative bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-3xl p-8 shadow-xl">
            <div className="text-center">
              {/* Success Icon */}
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 mb-6 relative">
                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400 animate-scale-in" />
                <div className="absolute inset-0 bg-green-400 dark:bg-green-600 blur-xl opacity-30"></div>
              </div>
              
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                Check Your Email
              </h2>
              
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                We've sent a password reset link to
              </p>
              <p className="text-lg font-semibold text-cyan-600 dark:text-cyan-400 mb-6">
                {email}
              </p>
              
              <div className="bg-cyan-50 dark:bg-cyan-900/30 border border-cyan-200 dark:border-cyan-800 rounded-xl p-4 mb-6">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  📧 Please check your email and click the link to reset your password.
                </p>
              </div>
              
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Didn't receive the email? Check your spam folder or try again.
                </p>
                
                <div className="flex flex-col space-y-3">
                  <Button
                    onClick={() => {
                      setIsSubmitted(false);
                      setEmail('');
                      setError('');
                    }}
                    className="w-full h-12 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl"
                  >
                    <Mail className="w-5 h-5 mr-2" />
                    Try Different Email
                  </Button>
                  
                  <Link href="/professor/login">
                    <Button 
                      variant="outline" 
                      className="w-full h-12 border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all font-semibold"
                    >
                      <ArrowLeft className="w-5 h-5 mr-2" />
                      Back to Professor Login
                    </Button>
                  </Link>

                  <Link href="/" className="text-center">
                    <Button 
                      variant="ghost" 
                      className="w-full h-12 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all"
                    >
                      Back to Home
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-200 via-gray-200 to-slate-100 dark:from-gray-900 dark:via-cyan-900 dark:to-teal-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-400 dark:bg-cyan-600 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-400 dark:bg-emerald-600 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-teal-400 dark:bg-teal-600 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Dark Mode Toggle */}
      <button
        onClick={toggleDarkMode}
        className="absolute top-6 right-6 p-3 rounded-xl bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all duration-300 z-10"
      >
        {isDarkMode ? (
          <Sun className="w-5 h-5 text-yellow-500" />
        ) : (
          <Moon className="w-5 h-5 text-gray-700" />
        )}
      </button>

      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-block group">
            <div className="flex items-center justify-center space-x-3 mb-2">
              <div className="relative">
                <BookOpen className="w-10 h-10 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform" />
                <div className="absolute inset-0 bg-cyan-400 dark:bg-cyan-600 blur-xl opacity-50"></div>
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-600 to-teal-600 dark:from-cyan-400 dark:to-teal-400 bg-clip-text text-transparent">
                FSAS
              </h1>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Furman Smart Attendance System</p>
          </Link>
          
          <div className="mt-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              Reset Professor Password
            </h2>
            <p className="mt-3 text-base text-gray-600 dark:text-gray-400">
              Enter your email address and we'll send you a secure link to reset your password.
            </p>
          </div>
        </div>

        {/* Forgot Password Form */}
        <Card className="relative bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-3xl p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <ErrorDisplay
                error={error}
                title="Password Reset Failed"
                onRetry={() => setError('')}
                showDetails={false}
              />
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Professor Email Address *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                </div>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={handleInputChange}
                  className="pl-10 h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-cyan-500 dark:text-white"
                  placeholder="professor@furman.edu"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                💡 Use the email address associated with your professor account
              </p>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Sending Reset Link...
                </div>
              ) : (
                <>
                  <Mail className="w-5 h-5 mr-2" />
                  Send Reset Link
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-col space-y-3 text-center">
              <Link href="/professor/login" className="group">
                <span className="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium inline-flex items-center justify-center transition-colors">
                  <ArrowLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" />
                  Back to Professor Login
                </span>
              </Link>
              <Link href="/" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
                Back to Home
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
