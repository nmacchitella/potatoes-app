'use client';

import Link from 'next/link';
import Image from 'next/image';
import FollowButton from './FollowButton';
import type { UserSearchResult } from '@/types';

interface UserCardProps {
  user: UserSearchResult;
  showFollowButton?: boolean;
  onFollowChange?: () => void;
}

export default function UserCard({ user, showFollowButton = true, onFollowChange }: UserCardProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-border">
      <Link
        href={`/profile/${user.id}`}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        <div className="relative w-12 h-12 rounded-full bg-cream-dark flex items-center justify-center flex-shrink-0 overflow-hidden">
          {user.profile_image_url ? (
            <Image
              src={user.profile_image_url}
              alt={user.name}
              fill
              sizes="48px"
              className="object-cover"
            />
          ) : (
            <span className="text-xl">{user.name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">{user.name}</p>
        </div>
      </Link>
      {showFollowButton && (
        <FollowButton
          userId={user.id}
          initialFollowStatus={user.follow_status || null}
          isPublic={user.is_public}
          onStatusChange={onFollowChange}
          size="sm"
        />
      )}
    </div>
  );
}
