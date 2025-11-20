'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Home,
  BookOpen,
  QrCode,
  Menu,
  X,
  Settings
} from 'lucide-react';

interface ProfessorNavigationProps {
  className?: string;
}

export default function ProfessorNavigation({ className = '' }: ProfessorNavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const navigationItems = [
    {
      href: '/professor/dashboard',
      label: 'Dashboard',
      icon: Home,
      isActive: pathname === '/professor/dashboard'
    },
    {
      href: '/professor/classes',
      label: 'Classes',
      icon: BookOpen,
      isActive: pathname === '/professor/classes' || pathname?.startsWith('/professor/classes/')
    },
    {
      href: '/professor/sessions',
      label: 'Sessions',
      icon: QrCode,
      isActive: pathname === '/professor/sessions' || pathname?.startsWith('/professor/sessions/')
    }
  ];

  const secondaryItems = [
    {
      href: '/professor/settings',
      label: 'Settings',
      icon: Settings
    }
  ];

  const NavButton = ({ item, variant = 'ghost' }: { item: any; variant?: 'ghost' | 'default' }) => (
    <Link href={item.href}>
      <Button
        variant={variant}
        size="sm"
        className={`${
          item.isActive
            ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900 hover:bg-blue-100 dark:hover:bg-blue-800'
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
        className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
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
            aria-hidden="true"
          />
          <div className="fixed top-16 left-4 right-4 sm:left-auto sm:right-4 sm:w-72 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 lg:hidden animate-fade-in">
            <div className="p-4 max-h-[calc(100vh-5rem)] overflow-y-auto">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3">
                Navigation
              </h3>

              {/* Primary Navigation */}
              <div className="space-y-2 mb-4">
                {navigationItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                      item.isActive
                        ? 'bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                ))}
              </div>

              {/* Secondary Navigation */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                  More
                </h4>
                <div className="space-y-2">
                  {secondaryItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
                    >
                      <item.icon className="w-4 h-4" />
                      <span className="text-sm">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
