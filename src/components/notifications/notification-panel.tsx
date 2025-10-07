'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, Trash2, X, ExternalLink } from 'lucide-react';
import { NotificationService, Notification, NotificationType } from '@/lib/notifications';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

export function NotificationPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const { user } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);

  // Load notifications
  useEffect(() => {
    console.log('🔔 NotificationPanel: useEffect triggered, user:', user ? user.id : 'null');
    if (user) {
      loadNotifications();
      loadUnreadCount();
    } else {
      console.log('🔔 NotificationPanel: No user found, stopping loading');
      setIsLoading(false);
    }
  }, [user]);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user) return;

    try {
      const subscription = NotificationService.subscribeToNotifications(
        user.id,
        (newNotification) => {
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Show browser notification if supported
          if (typeof window !== 'undefined' && typeof window.Notification !== 'undefined' && window.Notification.permission === 'granted') {
            new window.Notification(newNotification.title, {
              body: newNotification.message,
              icon: '/icon-192x192.png',
              badge: '/icon-192x192.png'
            });
          }
        }
      );

      return () => {
        NotificationService.unsubscribeFromNotifications(subscription);
      };
    } catch (error) {
      console.error('Error subscribing to notifications:', error);
    }
  }, [user]);

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Request notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.Notification !== 'undefined' && window.Notification.permission === 'default') {
      window.Notification.requestPermission();
    }
  }, []);

  const loadNotifications = async () => {
    if (!user) {
      console.log('🔔 NotificationPanel: No user, skipping load');
      setIsLoading(false);
      return;
    }
    
    console.log('🔔 NotificationPanel: Loading notifications for user:', user.id);
    setIsLoading(true);
    
    try {
      const data = await NotificationService.getUserNotifications(user.id);
      console.log('🔔 NotificationPanel: Loaded notifications:', data);
      setNotifications(data);
    } catch (error) {
      console.error('🔔 NotificationPanel: Error loading notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    if (!user) {
      console.log('🔔 NotificationPanel: No user, skipping unread count');
      return;
    }
    
    console.log('🔔 NotificationPanel: Loading unread count for user:', user.id);
    try {
      const count = await NotificationService.getUnreadCount(user.id);
      console.log('🔔 NotificationPanel: Unread count:', count);
      setUnreadCount(count);
    } catch (error) {
      console.error('🔔 NotificationPanel: Error loading unread count:', error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    const success = await NotificationService.markAsRead(notificationId);
    if (success) {
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    const success = await NotificationService.markAllAsRead(user.id);
    if (success) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  const handleDelete = async (notificationId: string) => {
    const success = await NotificationService.deleteNotification(notificationId);
    if (success) {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      // Update unread count if the deleted notification was unread
      const deletedNotification = notifications.find(n => n.id === notificationId);
      if (deletedNotification && !deletedNotification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }
  };

  const handleDeleteAll = async () => {
    if (!user) return;
    if (confirm('Are you sure you want to delete all notifications?')) {
      const success = await NotificationService.deleteAllNotifications(user.id);
      if (success) {
        setNotifications([]);
        setUnreadCount(0);
      }
    }
  };

  const getIconForType = (type: NotificationType) => {
    const emoji = NotificationService.getNotificationIcon(type);
    return <span className="text-xl">{emoji}</span>;
  };

  const getColorForPriority = (priority: string) => {
    const colors = {
      low: 'border-gray-300 dark:border-gray-600',
      medium: 'border-blue-300 dark:border-blue-600',
      high: 'border-orange-300 dark:border-orange-600',
      urgent: 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/10'
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const filteredNotifications = activeTab === 'unread' 
    ? notifications.filter(n => !n.is_read) 
    : notifications;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          ></div>
          
          <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Notifications
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'all'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setActiveTab('unread')}
                  className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'unread'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>
            </div>

            {/* Actions */}
            {notifications.length > 0 && (
              <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50">
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={unreadCount === 0}
                  className="flex items-center space-x-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>Mark all read</span>
                </button>
                <button
                  onClick={handleDeleteAll}
                  className="flex items-center space-x-1 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear all</span>
                </button>
              </div>
            )}

            {/* Notifications List */}
            <div className="max-h-[500px] overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-300 dark:border-blue-600 border-t-blue-600 dark:border-t-blue-400 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Loading notifications...</p>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">
                    {activeTab === 'unread' ? 'No unread notifications' : 'No notifications'}
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    {activeTab === 'unread' ? 'You\'re all caught up!' : 'You\'ll see notifications here'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                        !notification.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10 border-l-4 ' + getColorForPriority(notification.priority) : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        {/* Icon */}
                        <div className="flex-shrink-0 mt-0.5">
                          {getIconForType(notification.type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className={`text-sm font-semibold ${
                                !notification.is_read 
                                  ? 'text-gray-900 dark:text-white' 
                                  : 'text-gray-700 dark:text-gray-300'
                              }`}>
                                {notification.title}
                              </h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                                {NotificationService.formatRelativeTime(notification.created_at)}
                              </p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center space-x-2 mt-3">
                            {!notification.is_read && (
                              <button
                                onClick={() => handleMarkAsRead(notification.id)}
                                className="flex items-center space-x-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                              >
                                <Check className="w-3 h-3" />
                                <span>Mark read</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(notification.id)}
                              className="flex items-center space-x-1 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors ml-auto"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </>
      )}
    </div>
  );
}

