'use client';

import { useState } from 'react';
import { socialApi } from '@/lib/api';

interface FollowButtonProps {
  userId: string;
  initialFollowStatus: 'pending' | 'confirmed' | null;
  isPublic: boolean;
  onStatusChange?: (newStatus: 'pending' | 'confirmed' | null) => void;
  size?: 'sm' | 'md';
}

export default function FollowButton({
  userId,
  initialFollowStatus,
  isPublic,
  onStatusChange,
  size = 'md',
}: FollowButtonProps) {
  const [followStatus, setFollowStatus] = useState(initialFollowStatus);
  const [loading, setLoading] = useState(false);

  const handleFollow = async () => {
    setLoading(true);
    try {
      const response = await socialApi.follow(userId);
      setFollowStatus(response.status);
      onStatusChange?.(response.status);
    } catch (err) {
      console.error('Failed to follow:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async () => {
    setLoading(true);
    try {
      await socialApi.unfollow(userId);
      setFollowStatus(null);
      onStatusChange?.(null);
    } catch (err) {
      console.error('Failed to unfollow:', err);
    } finally {
      setLoading(false);
    }
  };

  const sizeClasses = size === 'sm'
    ? 'px-3 py-1 text-sm'
    : 'px-4 py-2';

  if (followStatus === 'confirmed') {
    return (
      <button
        onClick={handleUnfollow}
        disabled={loading}
        className={`${sizeClasses} border border-border text-warm-gray rounded-lg hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors disabled:opacity-50`}
      >
        {loading ? '...' : 'Following'}
      </button>
    );
  }

  if (followStatus === 'pending') {
    return (
      <button
        onClick={handleUnfollow}
        disabled={loading}
        className={`${sizeClasses} border border-border text-warm-gray rounded-lg hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors disabled:opacity-50`}
      >
        {loading ? '...' : 'Requested'}
      </button>
    );
  }

  return (
    <button
      onClick={handleFollow}
      disabled={loading}
      className={`${sizeClasses} bg-gold text-white rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50 font-medium`}
    >
      {loading ? '...' : 'Follow'}
    </button>
  );
}
