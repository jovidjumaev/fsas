import { supabase } from './supabase';
import { createLogger } from './logger';
import { now, addTime, formatDate, startOfDay } from './timezone-utils';
const logger = createLogger('name-change-service');

export interface NameChangeInfo {
  canChange: boolean;
  remainingChanges: number;
  lastChangeDate?: string;
  nextResetDate: string;
}

export interface NameChangeResult {
  success: boolean;
  message: string;
  remainingChanges?: number;
}

export class NameChangeService {
  /**
   * Check if user can change their name and get remaining changes
   */
  static async getNameChangeInfo(userId: string): Promise<NameChangeInfo> {
    try {
      // Try to get data from localStorage first (client-side tracking)
      if (typeof window === 'undefined') {
        // Server-side, return default values
        return {
          remainingChanges: 2,
          lastChangeDate: undefined,
          canChange: true,
          nextResetDate: formatDate(addTime(now(), 30, 'day'), 'YYYY-MM-DD')
        };
      }
      
      const storageKey = `name_changes_${userId}`;
      const storedData = localStorage.getItem(storageKey);
      
      if (storedData) {
        const data = JSON.parse(storedData);
        const currentTime = now();
        const currentMonth = currentTime.month();
        const currentYear = currentTime.year();

        // Check if we're in the same month
        if (data.month === currentMonth && data.year === currentYear) {
          const remainingChanges = Math.max(0, 2 - data.count);
          const nextMonth = startOfDay(addTime(currentTime.startOf('month'), 1, 'month'));
          const nextResetDate = formatDate(nextMonth, 'YYYY-MM-DD');

          return {
            canChange: remainingChanges > 0,
            remainingChanges,
            lastChangeDate: data.lastChange || undefined,
            nextResetDate
          };
        }
      }

      // If no stored data or different month, assume fresh start
      const currentTime = now();
      const nextMonth = startOfDay(addTime(currentTime.startOf('month'), 1, 'month'));
      const nextResetDate = formatDate(nextMonth, 'YYYY-MM-DD');
      
      return {
        canChange: true,
        remainingChanges: 2,
        lastChangeDate: undefined,
        nextResetDate
      };
    } catch (error) {
      logger.error('Error in getNameChangeInfo:', error);
      // Return fallback values if there's any error
      const currentTime = now();
      const nextMonth = startOfDay(addTime(currentTime.startOf('month'), 1, 'month'));
      const nextResetDate = formatDate(nextMonth, 'YYYY-MM-DD');

      return {
        canChange: true, // Allow changes if we can't check limits
        remainingChanges: 2, // Assume 2 changes available
        lastChangeDate: undefined,
        nextResetDate
      };
    }
  }

  /**
   * Attempt to change user's name with validation
   */
  static async changeName(
    userId: string,
    oldFirstName: string,
    oldLastName: string,
    newFirstName: string,
    newLastName: string,
    reason?: string
  ): Promise<NameChangeResult> {
    try {
      // Check name change limits using localStorage (fallback method)
      const nameChangeInfo = await this.getNameChangeInfo(userId);
      
      if (!nameChangeInfo.canChange) {
        return {
          success: false,
          message: 'You have reached the maximum number of name changes for this month (2). Please wait until next month to change your name again.'
        };
      }

      // Validate input
      if (!newFirstName.trim() || !newLastName.trim()) {
        return {
          success: false,
          message: 'First name and last name are required.'
        };
      }

      if (newFirstName.trim() === oldFirstName.trim() && newLastName.trim() === oldLastName.trim()) {
        return {
          success: false,
          message: 'New name must be different from current name.'
        };
      }

      // Record the name change in localStorage
      try {
        const storageKey = `name_changes_${userId}`;
        const currentTime = now();
        const currentMonth = currentTime.month();
        const currentYear = currentTime.year();
        
        // Get existing data
        const existingData = localStorage.getItem(storageKey);
        let data = existingData ? JSON.parse(existingData) : { count: 0, month: currentMonth, year: currentYear };
        
        // Reset if new month
        if (data.month !== currentMonth || data.year !== currentYear) {
          data = { count: 0, month: currentMonth, year: currentYear };
        }
        
        // Increment count
        data.count += 1;
        
        // Save back to localStorage
        localStorage.setItem(storageKey, JSON.stringify(data));
        
        logger.log('Name change recorded in localStorage:', data);
      } catch (error) {
        logger.error('Error recording name change in localStorage:', error);
        // Continue anyway - this is not critical
      }

      // Return success
      return {
        success: true,
        message: 'Name updated successfully!'
      };
    } catch (error) {
      logger.error('Error in changeName:', error);
      return {
        success: false,
        message: 'An error occurred while updating your name. Please try again.'
      };
    }
  }

  /**
   * Get name change history for user
   */
  static async getNameChangeHistory(userId: string) {
    try {
      const { data, error } = await supabase
        .from('name_change_history' as any)
        .select('*')
        .eq('user_id', userId)
        .order('changed_at', { ascending: false });

      if (error) {
        logger.error('Error getting name change history:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Error in getNameChangeHistory:', error);
      throw error;
    }
  }

  /**
   * Check if names are different
   */
  static areNamesDifferent(
    oldFirstName: string,
    oldLastName: string,
    newFirstName: string,
    newLastName: string
  ): boolean {
    return (
      oldFirstName.trim() !== newFirstName.trim() ||
      oldLastName.trim() !== newLastName.trim()
    );
  }

  /**
   * Format name change info for display
   */
  static formatNameChangeInfo(info: NameChangeInfo): string {
    if (info.remainingChanges === 0) {
      return `You have used all 2 name changes for this month. You can change your name again on ${info.nextResetDate}.`;
    } else if (info.remainingChanges === 1) {
      return `You have 1 name change remaining this month. Next reset: ${info.nextResetDate}.`;
    } else {
      return `You have 2 name changes remaining this month. Next reset: ${info.nextResetDate}.`;
    }
  }
}
