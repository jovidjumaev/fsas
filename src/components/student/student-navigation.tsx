'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Home,
  QrCode,
  BarChart3,
  Menu,
  X,
  BookOpen
} from 'lucide-react';

interface StudentNavigationProps {
  className?: string;
}

export default function StudentNavigation({ className = '' }: StudentNavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const navigationItems = [
    {
      href: '/student/dashboard',
      label: 'Dashboard',
      icon: Home,
      isActive: pathname === '/student/dashboard'
    },
    {
      href: '/student/scan',
      label: 'Scan QR',
      icon: QrCode,
      isActive: pathname === '/student/scan'
    },
    {
      href: '/student/attendance',
      label: 'Attendance',
      icon: BarChart3,
      isActive: pathname === '/student/attendance'
    },
    {
      href: '/student/classes',
      label: 'Classes',
      icon: BookOpen,
      isActive: pathname === '/student/classes'
    }
  ];

  const NavButton = ({ item, variant = 'ghost' }: { item: any; variant?: 'ghost' | 'default' }) => (
    <Link href={item.href}>
      <Button 
        variant={variant} 
        size="sm" 
        className={`${
          item.isActive 
            ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900 hover:bg-emerald-100 dark:hover:bg-emerald-800' 
            : 'hover:bg-slate-100 dark:hover:bg-slate-700'
        }`}
      >
        <item.icon className="w-4 h-4 mr-2" />
        {item.label}
      </Button>
    </Link>
  );

  return (
    <>
      {/* Desktop Navigation */}
      <nav className={`hidden lg:flex items-center space-x-1 ${className}`}>
        {navigationItems.map((item) => (
          <NavButton key={item.href} item={item} />
        ))}
      </nav>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        aria-label="Toggle navigation menu"
      >
        {isMobileMenuOpen ? (
          <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        ) : (
          <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        )}
      </button>

      {/* Mobile Navigation Overlay */}
      {isMobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="fixed top-16 right-4 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 z-50 lg:hidden">
            <div className="p-4">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3">
                Navigation
              </h3>
              
              {/* Primary Navigation */}
              <div className="space-y-2">
                {navigationItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                      item.isActive
                        ? 'bg-emerald-50 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
