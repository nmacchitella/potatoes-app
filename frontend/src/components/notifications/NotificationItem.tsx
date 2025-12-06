'use client';

import { useState } from 'react';
import Link from 'next/link';
import { socialApi } from '@/lib/api';
import type { Notification } from '@/types';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onFollowRequestHandled?: (notificationId: string) => void;
  onClick?: () => void;
}

const getTimeAgo = (date: string): string => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
};

const getNotificationIcon = (type: string): string => {
  switch (type) {
    case 'follow_request':
      return '👤';
    case 'follow_accepted':
      return '✅';
    case 'new_follower':
      return '👋';
    case 'new_recipe':
      return '🍽️';
    case 'recipe_cloned':
      return '📋';
    default:
      return '🔔';
  }
};

export default function NotificationItem({
  notification,
  onMarkAsRead,
  onFollowRequestHandled,
  onClick,
}: NotificationItemProps) {
  const [handling, setHandling] = useState<'accept' | 'decline' | null>(null);
  const [handled, setHandled] = useState(false);

  const handleClick = () => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id);
    }
    onClick?.();
  };

  const handleAccept = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const followerId = notification.metadata?.follower_id;
    if (!followerId) return;

    setHandling('accept');
    try {
      await socialApi.acceptFollowRequest(followerId);
      setHandled(true);
      onFollowRequestHandled?.(notification.id);
      if (!notification.is_read) {
        onMarkAsRead(notification.id);
      }
    } catch (err) {
      console.error('Failed to accept follow request:', err);
    } finally {
      setHandling(null);
    }
  };

  const handleDecline = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const followerId = notification.metadata?.follower_id;
    if (!followerId) return;

    setHandling('decline');
    try {
      await socialApi.declineFollowRequest(followerId);
      setHandled(true);
      onFollowRequestHandled?.(notification.id);
      if (!notification.is_read) {
        onMarkAsRead(notification.id);
      }
    } catch (err) {
      console.error('Failed to decline follow request:', err);
    } finally {
      setHandling(null);
    }
  };

  const isFollowRequest = notification.type === 'follow_request';
  // Show buttons only if it's a follow request, still actionable from backend, and not locally handled
  const showActions = isFollowRequest && notification.is_actionable === true && !handled;
  // Show "handled" message if it's a follow request and either locally handled or backend says not actionable
  const showHandledMessage = isFollowRequest && (handled || notification.is_actionable === false);

  const content = (
    <div
      className={`p-4 flex gap-3 hover:bg-cream-dark transition-colors cursor-pointer ${
        !notification.is_read ? 'bg-gold/5' : ''
      }`}
      onClick={handleClick}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-cream-dark flex items-center justify-center text-lg">
        {getNotificationIcon(notification.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${!notification.is_read ? 'font-medium text-charcoal' : 'text-warm-gray'}`}>
          {notification.title}
        </p>
        <p className="text-sm text-warm-gray truncate">{notification.message}</p>
        <p className="text-xs text-warm-gray/70 mt-1">{getTimeAgo(notification.created_at)}</p>

        {/* Follow request actions */}
        {showActions && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleAccept}
              disabled={handling !== null}
              className="px-3 py-1 text-xs font-medium bg-gold text-white rounded hover:bg-gold/90 disabled:opacity-50 transition-colors"
            >
              {handling === 'accept' ? 'Accepting...' : 'Accept'}
            </button>
            <button
              onClick={handleDecline}
              disabled={handling !== null}
              className="px-3 py-1 text-xs font-medium bg-cream-dark text-warm-gray rounded hover:bg-border disabled:opacity-50 transition-colors"
            >
              {handling === 'decline' ? 'Declining...' : 'Decline'}
            </button>
          </div>
        )}
        {showHandledMessage && (
          <p className="text-xs text-green-600 mt-2">Request handled</p>
        )}
      </div>
      {!notification.is_read && (
        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-gold mt-2" />
      )}
    </div>
  );

  // Make clickable link if there's a link and either not a follow request or already handled
  if (notification.link && (!isFollowRequest || showHandledMessage)) {
    return (
      <Link href={notification.link} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
