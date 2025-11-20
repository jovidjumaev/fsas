'use client';

import Link from 'next/link';
import { GraduationCap, Moon, Sun, Clock } from 'lucide-react';
import { NotificationPanel } from '@/components/notifications/notification-panel';
import ProfileDropdown from '@/components/profile/profile-dropdown';
import StudentNavigation from './student-navigation';
import { useState, useEffect } from 'react';

interface StudentHeaderProps {
  user: any;
  userProfile: any;
  onSignOut: () => void;
  onEditProfile: () => void;
  onChangePassword: () => void;
  onUploadAvatar: (file: File) => Promise<void>;
  onDeleteAvatar: () => Promise<void>;
}

export default function StudentHeader({
  user,
  userProfile,
  onSignOut,
  onEditProfile,
  onChangePassword,
  onUploadAvatar,
  onDeleteAvatar
}: StudentHeaderProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode') === 'true';
    setIsDarkMode(savedMode);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
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

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/student/dashboard" className="flex items-center space-x-3 group">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">FSAS</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Student Portal</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <StudentNavigation />

          {/* Right Side Actions */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Time - Hidden on mobile */}
            <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
              <Clock className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <NotificationPanel />

            <button
              onClick={toggleDarkMode}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? (
                <Sun className="w-5 h-5 text-amber-500" />
              ) : (
                <Moon className="w-5 h-5 text-slate-600" />
              )}
            </button>

            <ProfileDropdown
              user={user}
              userProfile={userProfile}
              onSignOut={onSignOut}
              onEditProfile={onEditProfile}
              onChangePassword={onChangePassword}
              onUploadAvatar={onUploadAvatar}
              onDeleteAvatar={onDeleteAvatar}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
