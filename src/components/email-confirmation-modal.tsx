'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Mail } from 'lucide-react';

interface EmailConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  userType: 'student' | 'professor';
}

export function EmailConfirmationModal({ isOpen, onClose, email, userType }: EmailConfirmationModalProps) {
  const router = useRouter();

  const handleOkClick = () => {
    onClose();
    // Redirect to appropriate login page
    if (userType === 'student') {
      router.push('/student/login');
    } else {
      router.push('/professor/login');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-center p-6 pb-4">
          <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
            <Mail className="w-8 h-8 text-green-600" />
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Account Created Successfully!
          </h3>
          
          <p className="text-gray-600 mb-4">
            Please check your email <strong>{email}</strong> and click the confirmation link to activate your account.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
            <div className="flex items-center text-blue-800 text-sm">
              <CheckCircle className="w-4 h-4 mr-2" />
              <span>Check your spam folder if you don't see the email</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Stay Here
            </button>
            <button
              onClick={handleOkClick}
              className="flex-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
            >
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
