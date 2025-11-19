'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { GraduationCap, Mail, Lock, ArrowRight, AlertCircle, Zap, Moon, Sun } from 'lucide-react';
import { createLogger } from '../../../lib/logger';
const logger = createLogger('page');

export default function StudentLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const router = useRouter();
  const { signIn } = useAuth();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    logger.log('🎓 Student Login: ===== FORM SUBMISSION STARTED =====');
    logger.log('🎓 Student Login: Form data:', { 
      email, 
      passwordLength: password?.length || 0,
      passwordProvided: !!password,
      isLoading,
      hasError: !!error
    });
    
    setIsLoading(true);
    setError('');

    try {
      logger.log('🎓 Student Login: Starting login process...');
      logger.log('🎓 Student Login: AuthContext available:', !!signIn);
      logger.log('🎓 Student Login: Router available:', !!router);
      
      // Validate input
      if (!email || !password) {
        logger.error('🎓 Student Login: VALIDATION FAILED - Missing fields');
        logger.error('🎓 Student Login: Email provided:', !!email);
        logger.error('🎓 Student Login: Password provided:', !!password);
        setError('Please fill in all fields');
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        logger.error('🎓 Student Login: VALIDATION FAILED - Invalid email format');
        setError('Please enter a valid email address');
        return;
      }

      // Validate password length
      if (password.length < 6) {
        logger.error('🎓 Student Login: VALIDATION FAILED - Password too short');
        setError('Password must be at least 6 characters long');
        return;
      }
      
      logger.log('🎓 Student Login: Input validation passed');
      logger.log('🎓 Student Login: Calling signIn function...');
      
      const result = await signIn(email, password, 'student');
      
      logger.log('🎓 Student Login: ===== SIGN-IN RESULT =====');
      logger.log('🎓 Student Login: Result object:', result);
      logger.log('🎓 Student Login: Success:', result.success);
      logger.log('🎓 Student Login: Error:', result.error);
      
      if (result.success) {
        logger.log('✅ Student Login: SUCCESS - Redirecting to dashboard');
        logger.log('🎓 Student Login: Router push to /student/dashboard');
        router.push('/student/dashboard');
      } else {
        logger.error('❌ Student Login: FAILED - Processing error');
        logger.error('❌ Student Login: Error message:', result.error);
        
        let errorMessage = result.error || 'Login failed. Please check your credentials.';
        
        // Handle specific error cases
        if (result.error?.includes('Please sign in as a')) {
          errorMessage = 'This account is not registered as a student. Please use the professor login page.';
          logger.error('🎓 Student Login: SPECIFIC ERROR - Role mismatch');
        } else if (result.error?.includes('Invalid email or password')) {
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
          logger.error('🎓 Student Login: SPECIFIC ERROR - Invalid credentials');
        } else if (result.error?.includes('Email not confirmed')) {
          errorMessage = 'Please check your email and click the confirmation link before signing in.';
          logger.error('🎓 Student Login: SPECIFIC ERROR - Email not confirmed');
        } else if (result.error?.includes('User profile not found')) {
          errorMessage = 'Account setup incomplete. Please contact support or try registering again.';
          logger.error('🎓 Student Login: SPECIFIC ERROR - Profile not found');
        } else if (result.error?.includes('Database error')) {
          errorMessage = 'System error. Please try again or contact support.';
          logger.error('🎓 Student Login: SPECIFIC ERROR - Database error');
        } else {
          logger.error('🎓 Student Login: GENERIC ERROR - Using provided message');
        }
        
        setError(errorMessage);
      }
    } catch (err: any) {
      logger.error('❌ Student Login: ===== UNEXPECTED ERROR =====');
      logger.error('❌ Student Login: Error type:', typeof err);
      logger.error('❌ Student Login: Error message:', err?.message);
      logger.error('❌ Student Login: Error stack:', err?.stack);
      logger.error('❌ Student Login: Full error:', JSON.stringify(err, null, 2));
      setError('An unexpected error occurred. Please try again.');
    } finally {
      logger.log('🎓 Student Login: ===== FORM SUBMISSION COMPLETED =====');
      logger.log('🎓 Student Login: Setting loading to false');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-200 via-gray-200 to-slate-100 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 dark:bg-blue-600 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400 dark:bg-purple-600 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-400 dark:bg-indigo-600 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
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
                <GraduationCap className="w-10 h-10 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                <div className="absolute inset-0 bg-blue-400 dark:bg-blue-600 blur-xl opacity-50"></div>
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                FSAS
              </h1>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Furman Smart Attendance System</p>
          </Link>
          
          <div className="mt-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              Student Login
            </h2>
            <p className="mt-3 text-base text-gray-600 dark:text-gray-400">
              Sign in to your student account
            </p>
          </div>
        </div>

        {/* Login Form Card */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-3xl opacity-0 group-hover:opacity-20 blur-xl transition-all duration-500"></div>
          <Card className="relative bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-3xl p-8 shadow-xl">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Email Address
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
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white"
                    placeholder="student@furman.edu"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </div>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white"
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end">
                <Link href="/student/forgot-password" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/50 transition-all duration-300 flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <span>Signing in...</span>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium">New student?</span>
                </div>
              </div>

              <div className="mt-6">
                <Link href="/student/register">
                  <Button variant="outline" className="w-full h-12 border-2 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 rounded-xl font-semibold transition-all dark:text-white dark:hover:bg-gray-700">
                    Create Student Account
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>

        {/* Back to Home */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center space-x-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
            <ArrowRight className="w-4 h-4 rotate-180" />
            <span>Back to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
