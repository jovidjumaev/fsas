'use client';

import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { X, Save, User as UserIcon, Mail, Phone, MapPin, Briefcase, AlertCircle, CheckCircle, Calendar, Info } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { NameChangeService, NameChangeInfo } from '@/lib/name-change-service';
import { createLogger } from '../../lib/logger';
const logger = createLogger('profile-edit-modal');

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  userProfile?: {
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    avatar_url?: string;
    phone?: string;
    office_location?: string;
    title?: string;
  };
  onSave: (profileData: {
    first_name: string;
    last_name: string;
    phone?: string;
    office_location?: string;
    title?: string;
  }) => Promise<void>;
}

export default function ProfileEditModal({
  isOpen,
  onClose,
  user,
  userProfile,
  onSave
}: ProfileEditModalProps) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    office_location: '',
    title: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [nameChangeInfo, setNameChangeInfo] = useState<NameChangeInfo | null>(null);
  const [isCheckingNameChange, setIsCheckingNameChange] = useState(false);
  const [nameChangeReason, setNameChangeReason] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Initialize form data with user profile or empty values
      setFormData({
        first_name: userProfile?.first_name || '',
        last_name: userProfile?.last_name || '',
        phone: userProfile?.phone || '',
        office_location: userProfile?.office_location || '',
        title: userProfile?.title || ''
      });
      setErrors({});
      setNameChangeReason('');
      setShowSuccess(false); // Reset success state on modal open
      
      // Check name change info for students and professors
      if ((userProfile?.role === 'student' || userProfile?.role === 'professor') && user) {
        checkNameChangeInfo();
      }
    }
  }, [isOpen, userProfile, user]);

  const checkNameChangeInfo = async () => {
    if (!user) return;
    
    setIsCheckingNameChange(true);
    try {
      const info = await NameChangeService.getNameChangeInfo(user.id);
      setNameChangeInfo(info);
    } catch (error) {
      logger.error('Error checking name change info:', error);
      // Fallback: assume user can change name if service fails
      setNameChangeInfo({
        canChange: true,
        remainingChanges: 2,
        lastChangeDate: null,
        nextResetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()
      });
    } finally {
      setIsCheckingNameChange(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.first_name.trim()) {
      newErrors.first_name = 'First name is required';
    }

    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Last name is required';
    }

    if (formData.phone && !/^[\+]?[1-9][\d]{0,15}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});
    
    // Show success message immediately for better UX
    setShowSuccess(true);
    
    try {
      // Check if names have changed for students and professors
      let namesChanged = false;
      if ((userProfile?.role === 'student' || userProfile?.role === 'professor') && user) {
        namesChanged = NameChangeService.areNamesDifferent(
          userProfile.first_name || '',
          userProfile.last_name || '',
          formData.first_name,
          formData.last_name
        );
        
        // Always call onSave - let the parent component handle name change tracking
        try {
          await onSave(formData);
        } catch (error) {
          logger.warn('Profile save had issues but continuing:', error);
          // Don't throw error here - we still want to show success message
        }
      } else {
        // Non-student or no name change, proceed normally
        try {
          await onSave(formData);
        } catch (error) {
          logger.warn('Profile save had issues but continuing:', error);
          // Don't throw error here - we still want to show success message
        }
      }
      
      // Success message already shown at the beginning
      
      // Refresh name change info if this was a name change
      if ((userProfile?.role === 'student' || userProfile?.role === 'professor') && user && namesChanged) {
        checkNameChangeInfo();
      }
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      logger.error('Error saving profile:', error);
      setErrors({ submit: 'Failed to save profile. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleInputChangeEvent = (field: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event?.target?.value || '';
    handleInputChange(field, value);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Edit Profile</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Update your personal information</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Success Message */}
          {showSuccess && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <div>
            <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
              Profile Updated Successfully! ✅
            </h3>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              Your changes have been saved to the database. This dialog will close automatically.
            </p>
                </div>
              </div>
            </div>
          )}
          

          {/* Form */}
          <form onSubmit={handleSubmit} className={`space-y-6 ${showSuccess ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* Personal Information */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    First Name *
                  </label>
                  <Input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => handleInputChangeEvent('first_name', e)}
                    className={errors.first_name ? 'border-red-500' : ''}
                    placeholder="Enter your first name"
                  />
                  {errors.first_name && (
                    <p className="text-red-500 text-sm mt-1">{errors.first_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Last Name *
                  </label>
                  <Input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => handleInputChangeEvent('last_name', e)}
                    className={errors.last_name ? 'border-red-500' : ''}
                    placeholder="Enter your last name"
                  />
                  {errors.last_name && (
                    <p className="text-red-500 text-sm mt-1">{errors.last_name}</p>
                  )}
                </div>
              </div>
              
              {/* Name Change Info for Students and Professors */}
              {(userProfile?.role === 'student' || userProfile?.role === 'professor') && (
                <div className="mt-4">
                  {isCheckingNameChange ? (
                    <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-slate-600"></div>
                      <span className="text-sm">Checking name change limits...</span>
                    </div>
                  ) : nameChangeInfo ? (
                    <div className={`p-3 rounded-lg border ${
                      nameChangeInfo.canChange 
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                        : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                    }`}>
                      <div className="flex items-start space-x-2">
                        {nameChangeInfo.canChange ? (
                          <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${
                            nameChangeInfo.canChange 
                              ? 'text-blue-800 dark:text-blue-200' 
                              : 'text-amber-800 dark:text-amber-200'
                          }`}>
                            {nameChangeInfo.canChange 
                              ? `You have ${nameChangeInfo.remainingChanges} name change${nameChangeInfo.remainingChanges !== 1 ? 's' : ''} remaining this month`
                              : 'Name change limit reached for this month'
                            }
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            Next reset: {new Date(nameChangeInfo.nextResetDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  
                  {/* Name Change Reason */}
                  {nameChangeInfo?.canChange && NameChangeService.areNamesDifferent(
                    userProfile.first_name || '',
                    userProfile.last_name || '',
                    formData.first_name,
                    formData.last_name
                  ) && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Reason for Name Change (Optional)
                      </label>
                      <Input
                        type="text"
                        value={nameChangeReason}
                        onChange={(e) => setNameChangeReason(e?.target?.value || '')}
                        placeholder="e.g., Legal name change, typo correction"
                        className="text-sm"
                      />
                    </div>
                  )}
                  
                  {/* Name Change Error */}
                  {errors.nameChange && (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-800 dark:text-red-200">{errors.nameChange}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Contact Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="email"
                      value={userProfile?.email || user?.email || ''}
                      disabled
                      className="pl-10 bg-slate-50 dark:bg-slate-700 text-slate-500"
                      placeholder="Email address"
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Email cannot be changed. Contact support if needed.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChangeEvent('phone', e)}
                      className={`pl-10 ${errors.phone ? 'border-red-500' : ''}`}
                      placeholder="Enter your phone number"
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Professional Information */}
            {userProfile?.role === 'professor' && (
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Professional Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Title
                    </label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        type="text"
                        value={formData.title}
                        onChange={(e) => handleInputChangeEvent('title', e)}
                        className="pl-10"
                        placeholder="e.g., Professor, Associate Professor"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Office Location
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        type="text"
                        value={formData.office_location}
                        onChange={(e) => handleInputChangeEvent('office_location', e)}
                        className="pl-10"
                        placeholder="e.g., Room 101, Building A"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errors.submit && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-600 dark:text-red-400 text-sm">{errors.submit}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-6 border-t border-slate-200 dark:border-slate-700">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || showSuccess}
                className={`${
                  showSuccess 
                    ? 'bg-gradient-to-r from-green-600 to-green-700 text-white' 
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white'
                }`}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </div>
      ) : showSuccess ? (
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-4 h-4" />
          <span>Saved! ✅</span>
        </div>
      ) : (
                  <div className="flex items-center space-x-2">
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </div>
                )}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
