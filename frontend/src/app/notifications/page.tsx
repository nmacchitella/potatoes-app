'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { notificationApi } from '@/lib/api';
import Navbar from '@/components/layout/Navbar';
import MobileNavWrapper from '@/components/layout/MobileNavWrapper';
import type { Notification } from '@/types';

const getTimeAgo = (date: string): string => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return new Date(date).toLocaleDateString();
};

const getNotificationIcon = (type: string): string => {
  switch (type) {
    case 'follow_request':
      return '\u{1F464}';
    case 'follow_accepted':
      return '\u2705';
    case 'new_recipe':
      return '\u{1F37D}\uFE0F';
    case 'recipe_cloned':
      return '\u{1F4CB}';
    default:
      return '\u{1F514}';
  }
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    loadNotifications();
  }, [filter]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationApi.list(filter === 'unread', 50);
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications(notifications.map(n =>
        n.id === id ? { ...n, is_read: true } : n
      ));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await notificationApi.delete(id);
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-cream has-bottom-nav">
      <Navbar />
      <MobileNavWrapper />
      <div className="p-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-serif text-3xl text-charcoal">Notifications</h1>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-gold hover:underline text-sm"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 bg-white rounded-lg border border-border p-1 mb-6 w-fit">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-md text-sm transition-colors ${
              filter === 'all'
                ? 'bg-gold text-white font-medium'
                : 'text-warm-gray hover:text-charcoal'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-md text-sm transition-colors ${
              filter === 'unread'
                ? 'bg-gold text-white font-medium'
                : 'text-warm-gray hover:text-charcoal'
            }`}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-white rounded-lg border border-border" />
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="card text-center py-16">
            <svg
              className="w-16 h-16 mx-auto text-warm-gray mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p className="text-warm-gray mb-2">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="text-warm-gray text-sm">
              {filter === 'unread'
                ? 'You\'re all caught up!'
                : 'When you get notifications, they\'ll appear here'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`card flex gap-4 items-start ${
                  !notification.is_read ? 'border-gold/30' : ''
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-cream-dark flex items-center justify-center text-xl flex-shrink-0">
                  {getNotificationIcon(notification.type)}
                </div>

                <div className="flex-1 min-w-0">
                  {notification.link ? (
                    <Link
                      href={notification.link}
                      onClick={() => !notification.is_read && handleMarkAsRead(notification.id)}
                      className="block hover:text-gold"
                    >
                      <p className={`text-charcoal ${!notification.is_read ? 'font-semibold' : ''}`}>
                        {notification.title}
                      </p>
                      <p className="text-warm-gray text-sm mt-1">{notification.message}</p>
                    </Link>
                  ) : (
                    <>
                      <p className={`text-charcoal ${!notification.is_read ? 'font-semibold' : ''}`}>
                        {notification.title}
                      </p>
                      <p className="text-warm-gray text-sm mt-1">{notification.message}</p>
                    </>
                  )}
                  <p className="text-warm-gray text-xs mt-2">{getTimeAgo(notification.created_at)}</p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {!notification.is_read && (
                    <button
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="text-warm-gray hover:text-gold text-sm"
                      title="Mark as read"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(notification.id)}
                    className="text-warm-gray hover:text-red-500"
                    title="Delete"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
