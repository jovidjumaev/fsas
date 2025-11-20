import { createLogger } from '@/lib/logger';
import { mutate } from 'swr';

const logger = createLogger('sign-out-service');

export class SignOutService {
  /**
   * Clear all cached data immediately for instant sign-out
   */
  static async clearAllCaches() {
    logger.debug('Clearing all SWR caches for sign-out');

    // Clear all SWR caches globally
    // This ensures no stale data remains after sign-out
    await mutate(
      () => true, // Match all keys
      undefined, // Clear the data
      { revalidate: false } // Don't refetch
    );

    logger.debug('All caches cleared');
  }

  /**
   * Clear all browser storage to prevent session persistence
   * but preserve user preferences like theme
   */
  static clearBrowserStorage() {
    logger.debug('Clearing browser storage');

    if (typeof window !== 'undefined') {
      // Preserve user preferences
      const darkMode = localStorage.getItem('darkMode');

      // Clear all localStorage items related to Supabase/auth
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('auth'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Restore preserved preferences
      if (darkMode !== null) {
        localStorage.setItem('darkMode', darkMode);
      }

      // Clear sessionStorage completely
      sessionStorage.clear();

      // Clear cookies if possible (limited by browser security)
      document.cookie.split(";").forEach((c) => {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
    }

    logger.debug('Browser storage cleared (preferences preserved)');
  }

  /**
   * Clear specific user-related caches
   */
  static async clearUserCaches(userId: string) {
    logger.debug('Clearing user-specific caches for:', userId);

    // Clear specific cache keys related to the user
    const cacheKeys = [
      // Student caches
      ['student-dashboard-cached', userId],
      ['student-attendance-cached', userId],
      ['student-classes-cached', userId],
      ['class-detail', userId],
      ['student-classes', userId],
      ['student-attendance', userId],
      // Professor caches
      [`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/professors/${userId}/dashboard`],
      [`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/professors/${userId}/classes`],
      [`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/professors/${userId}/sessions`],
      [`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/courses`],
      [`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/academic-periods`],
    ];

    // Clear each cache key
    for (const key of cacheKeys) {
      await mutate(key, undefined, { revalidate: false });
    }

    logger.debug('User caches cleared');
  }

  /**
   * Perform a fast sign-out with immediate cache clearing
   */
  static async performFastSignOut(
    clearLocalState: () => void,
    redirectUrl: string,
    supabaseSignOut: () => Promise<void>
  ) {
    logger.debug('Starting optimized sign-out process');

    // Step 1: Clear all caches immediately
    await this.clearAllCaches();

    // Step 2: Clear local state immediately
    clearLocalState();

    // Step 3: Start redirect immediately
    logger.debug(`Redirecting to: ${redirectUrl}`);
    window.location.replace(redirectUrl);

    // Step 4: Sign out from Supabase in background
    // This happens after redirect, so user doesn't wait
    supabaseSignOut()
      .then(() => {
        logger.debug('Background Supabase sign-out completed');
      })
      .catch((error) => {
        logger.error('Background sign-out error:', error);
        // Non-critical error since we already cleared local state
      });
  }
}