import type { ShareableUser } from './user';

// ============================================================================
// LIBRARY SHARING TYPES (Partner/Family Sharing)
// ============================================================================

export interface LibraryShareResponse {
  id: string;
  inviter: ShareableUser;
  invitee: ShareableUser;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  accepted_at?: string;
}

export interface LibraryPartner {
  id: string; // Partner's user ID
  name: string;
  profile_image_url?: string;
  share_id: string; // LibraryShare ID for removing
  since: string; // When the share was accepted
}

export interface PendingLibraryInvite {
  id: string; // LibraryShare ID
  inviter: ShareableUser;
  created_at: string;
}

export interface LibraryShareCreateInput {
  invitee_id: string;
}
