'use client';

import Link from 'next/link';
import type { Notification } from '@/types';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
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
  onClick,
}: NotificationItemProps) {
  const handleClick = () => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id);
    }
    onClick?.();
  };

  const content = (
    <div
      className={`p-4 flex gap-3 hover:bg-dark-hover transition-colors cursor-pointer ${
        !notification.is_read ? 'bg-primary/5' : ''
      }`}
      onClick={handleClick}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-dark-hover flex items-center justify-center text-lg">
        {getNotificationIcon(notification.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${!notification.is_read ? 'font-medium' : 'text-gray-300'}`}>
          {notification.title}
        </p>
        <p className="text-sm text-gray-400 truncate">{notification.message}</p>
        <p className="text-xs text-gray-500 mt-1">{getTimeAgo(notification.created_at)}</p>
      </div>
      {!notification.is_read && (
        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-2" />
      )}
    </div>
  );

  if (notification.link) {
    return (
      <Link href={notification.link} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
