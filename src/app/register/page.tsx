'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student' as 'student' | 'professor',
    studentNumber: '',
    employeeId: '',
    major: '',
    title: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { user, userRole, loading, signUp } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user && userRole) {
      if (userRole === 'student') {
        router.push('/student/dashboard');
      } else if (userRole === 'professor') {
        router.push('/professor/dashboard');
      }
    }
  }, [user, userRole, loading, router]);

  const handleInputChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e?.target?.value || '';
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted with data:', formData);
    console.log('Form validation starting...');
    setIsLoading(true);
    setError('');

    // Basic validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 12) {
      setError('Password must be at least 12 characters long for security');
      setIsLoading(false);
      return;
    }

    // Email validation (domain and uniqueness) will be handled by auth context

    if (formData.role === 'student' && !formData.studentNumber) {
      setError('Student number is required');
      setIsLoading(false);
      return;
    }

    if (formData.role === 'professor' && !formData.employeeId) {
      setError('Employee ID is required');
      setIsLoading(false);
      return;
    }

    try {
      console.log('Calling signUp with:', { email: formData.email, role: formData.role, additionalData: formData });
      const result = await signUp(formData.email, formData.password, formData.role, formData);
      console.log('SignUp result:', result);
      
      if (result.success) {
        console.log('Registration successful');
        
        // Check if email confirmation is required
        if (result.requiresEmailConfirmation) {
          console.log('Email confirmation required');
          setError(result.message || 'Please check your email for confirmation instructions.');
          return;
        }
        
        // Redirect to dashboard if email is already confirmed
        if (formData.role === 'student') {
          router.push('/student/dashboard');
        } else {
          router.push('/professor/dashboard');
        }
      } else {
        console.error('Registration failed:', result.error);
        setError(result.error || 'Registration failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      
      // Extract specific error message
      let errorMessage = 'Registration failed. Please try again.';
      
      if (err?.message) {
        errorMessage = err.message;
      } else if (err?.error) {
        errorMessage = err.error;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      // Handle specific Supabase errors
      if (errorMessage.includes('already registered') || errorMessage.includes('already exists')) {
        errorMessage = `This email is already registered.\n\n💡 Please sign in instead at /${formData.role}/login`;
      } else if (errorMessage.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials.';
      } else if (errorMessage.includes('Password should be at least')) {
        errorMessage = 'Password must be at least 6 characters long.';
      } else if (errorMessage.includes('Invalid email')) {
        errorMessage = 'Please enter a valid email address.';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">FSAS</h1>
          <p className="text-sm text-gray-500">Furman Smart Attendance System</p>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">
            Create Account
          </h2>
        </div>

        {/* Registration Form */}
        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                I am a:
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="role"
                    value="student"
                    checked={formData.role === 'student'}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as 'student' | 'professor' }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">Student</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="role"
                    value="professor"
                    checked={formData.role === 'professor'}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as 'student' | 'professor' }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">Professor</span>
                </label>
              </div>
            </div>

            {/* Personal Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  First Name
                </label>
                <Input
                  id="firstName"
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={handleInputChange('firstName')}
                  className="mt-1"
                  placeholder="John"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Last Name
                </label>
                <Input
                  id="lastName"
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={handleInputChange('lastName')}
                  className="mt-1"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address * <span className="text-xs text-gray-500">(@furman.edu only)</span>
              </label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={handleInputChange('email')}
                className="mt-1"
                placeholder="your.email@furman.edu"
              />
              {formData.email && formData.email.length > 0 && (
                <p className={`mt-2 text-sm flex items-center ${
                  formData.email.endsWith('@furman.edu') 
                    ? 'text-green-600' 
                    : 'text-orange-600'
                }`}>
                  <span className="mr-1">⚠</span>
                  {formData.email.endsWith('@furman.edu')
                    ? '✓ Valid Furman email format'
                    : 'Only @furman.edu email addresses are allowed'
                  }
                </p>
              )}
            </div>

            {/* Role-specific fields */}
            {formData.role === 'student' ? (
              <>
                <div>
                  <label htmlFor="studentNumber" className="block text-sm font-medium text-gray-700">
                    Student ID Number * <span className="text-xs text-gray-500">(7 digits)</span>
                  </label>
                  <Input
                    id="studentNumber"
                    type="text"
                    required
                    value={formData.studentNumber}
                    onChange={handleInputChange('studentNumber')}
                    className="mt-1"
                    placeholder="5002378"
                    maxLength={7}
                    pattern="\d{7}"
                    title="Student ID must be exactly 7 digits"
                  />
                  {formData.studentNumber && formData.studentNumber.length > 0 && (
                    <p className={`mt-2 text-sm flex items-center ${
                      /^\d{7}$/.test(formData.studentNumber) 
                        ? 'text-green-600' 
                        : 'text-orange-600'
                    }`}>
                      <span className="mr-1">⚠</span>
                      {/^\d{7}$/.test(formData.studentNumber)
                        ? '✓ Valid student ID format'
                        : `${formData.studentNumber.length}/7 digits - Must be exactly 7 digits`
                      }
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="major" className="block text-sm font-medium text-gray-700">
                    Major (Optional)
                  </label>
                  <Input
                    id="major"
                    type="text"
                    value={formData.major}
                    onChange={handleInputChange('major')}
                    className="mt-1"
                    placeholder="Computer Science"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700">
                    Employee ID
                  </label>
                  <Input
                    id="employeeId"
                    type="text"
                    required
                    value={formData.employeeId}
                    onChange={handleInputChange('employeeId')}
                    className="mt-1"
                    placeholder="EMP-001"
                  />
                </div>
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                    Title (Optional)
                  </label>
                  <Input
                    id="title"
                    type="text"
                    value={formData.title}
                    onChange={handleInputChange('title')}
                    className="mt-1"
                    placeholder="Associate Professor"
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <Input
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={handleInputChange('password')}
                className="mt-1"
                placeholder="Enter your password"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleInputChange('confirmPassword')}
                className="mt-1"
                placeholder="Confirm your password"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Already have an account?</span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600 mb-4">
                Already have an account?{' '}
                <Link href="/student/login" className="text-blue-600 hover:text-blue-800 font-medium">
                  Sign In as Student
                </Link>
                {' or '}
                <Link href="/professor/login" className="text-green-600 hover:text-green-800 font-medium">
                  Sign In as Professor
                </Link>
              </p>
            </div>
          </div>
        </Card>

        {/* Debug Link */}
        <div className="text-center">
          <Link href="/debug-page" className="text-sm text-gray-500 hover:text-gray-700">
            Debug Page
          </Link>
        </div>
      </div>
    </div>
  );
}
