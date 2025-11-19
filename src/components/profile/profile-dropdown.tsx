'use client';

import { useState, useRef, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { 
  User as UserIcon, 
  Settings, 
  Key, 
  Camera, 
  LogOut, 
  ChevronDown,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  Edit3,
  Trash2
} from 'lucide-react';
import { Button } from '../ui/button';
import { createLogger } from '../../lib/logger';
const logger = createLogger('profile-dropdown');

interface ProfileDropdownProps {
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
  onSignOut: () => void;
  onEditProfile: () => void;
  onChangePassword: () => void;
  onUploadAvatar: (file: File) => void;
  onDeleteAvatar: () => void;
}

export default function ProfileDropdown({
  user,
  userProfile,
  onSignOut,
  onEditProfile,
  onChangePassword,
  onUploadAvatar,
  onDeleteAvatar
}: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      await onUploadAvatar(file);
    } catch (error) {
      logger.error('Error uploading avatar:', error);
      alert('Failed to upload avatar. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!userProfile?.avatar_url) {
      return;
    }

    if (!confirm('Are you sure you want to delete your profile picture? This action cannot be undone.')) {
      return;
    }

    try {
      await onDeleteAvatar();
    } catch (error) {
      logger.error('Error deleting avatar:', error);
      alert('Failed to delete avatar. Please try again.');
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'professor':
        return 'Professor';
      case 'student':
        return 'Student';
      case 'admin':
        return 'Administrator';
      default:
        return 'User';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        {/* Avatar */}
        <div className="relative">
          {userProfile?.avatar_url ? (
            <img
              src={userProfile.avatar_url}
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover border-2 border-slate-200 dark:border-slate-600"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-semibold">
              {userProfile ? getInitials(userProfile.first_name, userProfile.last_name) : 
               user?.user_metadata?.first_name && user?.user_metadata?.last_name ? 
               getInitials(user.user_metadata.first_name, user.user_metadata.last_name) : 'U'}
            </div>
          )}
          {/* Online indicator */}
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800"></div>
        </div>

        {/* User Info */}
        <div className="hidden sm:block text-left">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 
             user?.user_metadata?.first_name && user?.user_metadata?.last_name ? 
             `${user.user_metadata.first_name} ${user.user_metadata.last_name}` : 'User'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-32">
            {userProfile?.email || user?.email}
          </p>
        </div>

        {/* Dropdown Arrow */}
        <ChevronDown className={`w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 z-50">
          {/* Profile Header */}
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center space-x-4">
                {/* Large Avatar */}
                <div className="relative">
                  {userProfile?.avatar_url ? (
                    <img
                      src={userProfile.avatar_url}
                      alt="Profile"
                      className="w-16 h-16 rounded-full object-cover border-4 border-slate-200 dark:border-slate-600"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xl font-semibold">
                      {userProfile ? getInitials(userProfile.first_name, userProfile.last_name) : 
                       user?.user_metadata?.first_name && user?.user_metadata?.last_name ? 
                       getInitials(user.user_metadata.first_name, user.user_metadata.last_name) : 'U'}
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="absolute -bottom-1 -right-1 flex space-x-1">
                    {/* Upload Button */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-6 h-6 bg-emerald-500 hover:bg-emerald-600 rounded-full flex items-center justify-center text-white text-xs transition-colors disabled:opacity-50"
                      title="Upload new photo"
                    >
                      {isUploading ? (
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Camera className="w-3 h-3" />
                      )}
                    </button>
                    
                    {/* Delete Button - only show if avatar exists */}
                    {userProfile?.avatar_url && (
                      <button
                        onClick={handleDeleteAvatar}
                        disabled={isUploading}
                        className="w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-xs transition-colors disabled:opacity-50"
                        title="Delete photo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>

                {/* User Details */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                    {userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 
                     user?.user_metadata?.first_name && user?.user_metadata?.last_name ? 
                     `${user.user_metadata.first_name} ${user.user_metadata.last_name}` : 'User'}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                    {userProfile?.email || user?.email}
                  </p>
                  <div className="flex items-center space-x-2 mt-1">
                    <Shield className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {getRoleDisplay(userProfile?.role || user?.user_metadata?.role || 'user')}
                    </span>
                  </div>
                </div>
              </div>
          </div>

          {/* Profile Information */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Profile Information</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-3 text-sm">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-300 truncate">
                    {userProfile?.email || user?.email}
                  </span>
                </div>
                {userProfile?.phone && (
                  <div className="flex items-center space-x-3 text-sm">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600 dark:text-slate-300">{userProfile.phone}</span>
                  </div>
                )}
                {userProfile?.office_location && (
                  <div className="flex items-center space-x-3 text-sm">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600 dark:text-slate-300">{userProfile.office_location}</span>
                  </div>
                )}
                {userProfile?.title && (
                  <div className="flex items-center space-x-3 text-sm">
                    <UserIcon className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600 dark:text-slate-300">{userProfile.title}</span>
                  </div>
                )}
                <div className="flex items-center space-x-3 text-sm">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-300">
                    Member since {new Date(user?.created_at || '').toLocaleDateString()}
                  </span>
                </div>
              </div>
          </div>

          {/* Action Buttons */}
          <div className="p-4 space-y-2">
              <Button
                onClick={() => {
                  onEditProfile();
                  setIsOpen(false);
                }}
                variant="ghost"
                className="w-full justify-start hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Edit3 className="w-4 h-4 mr-3" />
                Edit Profile
              </Button>
              <Button
                onClick={() => {
                  onChangePassword();
                  setIsOpen(false);
                }}
                variant="ghost"
                className="w-full justify-start hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Key className="w-4 h-4 mr-3" />
                Change Password
              </Button>
              <Button
                onClick={() => {
                  onSignOut();
                  setIsOpen(false);
                }}
                variant="ghost"
                className="w-full justify-start text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-red-400"
              >
                <LogOut className="w-4 h-4 mr-3" />
                Sign Out
              </Button>
          </div>
        </div>
      )}
    </div>
  );
}
