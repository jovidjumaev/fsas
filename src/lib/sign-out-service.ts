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
   * Clear specific user-related caches
   */
  static async clearUserCaches(userId: string) {
    logger.debug('Clearing user-specific caches for:', userId);

    // Clear specific cache keys related to the user
    const cacheKeys = [
      ['student-dashboard-cached', userId],
      ['student-attendance-cached', userId],
      ['student-classes-cached', userId],
      ['class-detail', userId],
      ['student-classes', userId],
      ['student-attendance', userId],
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