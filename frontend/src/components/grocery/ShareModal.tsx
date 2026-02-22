'use client';

import { useState, useEffect } from 'react';
import { groceryListApi, getErrorMessage } from '@/lib/api';
import { Modal } from '@/components/ui';
import type { GroceryListShare } from '@/types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  listId: string;
  listName: string;
  shares: GroceryListShare[];
  onRemoveShare: (userId: string) => Promise<void>;
}

export function ShareModal({
  isOpen,
  onClose,
  listId,
  listName,
  shares,
  onRemoveShare,
}: ShareModalProps) {
  // Link sharing state
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Email sharing state
  const [email, setEmail] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  // Remove share state
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  // Generate share link on modal open
  useEffect(() => {
    if (isOpen && !shareLink) {
      generateShareLink();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setEmailResult(null);
      setLinkCopied(false);
      setShareLink(null);
    }
  }, [isOpen]);

  const generateShareLink = async () => {
    setIsGeneratingLink(true);
    try {
      const { share_token } = await groceryListApi.getOrCreateShareLink(listId);
      const link = `${window.location.origin}/grocery/share/${share_token}`;
      setShareLink(link);
    } catch (err) {
      console.error('Failed to generate share link:', err);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleCopyLink = async () => {
    if (shareLink) {
      await navigator.clipboard.writeText(shareLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSendingEmail(true);
    setEmailResult(null);
    try {
      const result = await groceryListApi.shareViaEmail(listId, email.trim());
      setEmailResult({ success: true, message: result.message });
      setEmail('');
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to send invitation');
      setEmailResult({ success: false, message });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleRemoveShare = async (userId: string) => {
    setRemovingUserId(userId);
    try {
      await onRemoveShare(userId);
    } catch (err) {
      console.error('Failed to remove share:', err);
    } finally {
      setRemovingUserId(null);
    }
  };

  const acceptedShares = shares.filter(s => s.status === 'accepted');
  const pendingShares = shares.filter(s => s.status === 'pending');

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" ariaLabel={`Share ${listName}`}>
      <div className="bg-white rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white rounded-t-xl">
          <h2 className="text-lg font-semibold text-charcoal">Share &quot;{listName}&quot;</h2>
          <button
            onClick={onClose}
            className="p-1 text-warm-gray hover:text-charcoal transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Share Link Section */}
          <div>
            <h3 className="text-sm font-medium text-charcoal mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-warm-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Share Link
            </h3>
            <p className="text-sm text-warm-gray mb-3">
              Anyone with this link can view and edit your grocery list
            </p>
            {isGeneratingLink ? (
              <div className="flex items-center justify-center py-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-gold border-t-transparent" />
              </div>
            ) : shareLink ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareLink}
                  readOnly
                  className="flex-1 px-3 py-2 text-sm bg-cream border border-border rounded-lg text-charcoal truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    linkCopied
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gold text-white hover:bg-gold/90'
                  }`}
                >
                  {linkCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            ) : (
              <p className="text-sm text-red-500">Failed to generate link</p>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Share via Email Section */}
          <div>
            <h3 className="text-sm font-medium text-charcoal mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-warm-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Share via Email
            </h3>
            <p className="text-sm text-warm-gray mb-3">
              Send an invitation email with a link to view the list
            </p>
            <form onSubmit={handleSendEmail} className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
                required
              />
              <button
                type="submit"
                disabled={isSendingEmail || !email.trim()}
                className="px-4 py-2 bg-gold text-white rounded-lg text-sm font-medium hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {isSendingEmail ? 'Sending...' : 'Send'}
              </button>
            </form>
            {emailResult && (
              <p className={`text-sm mt-2 ${emailResult.success ? 'text-green-600' : 'text-red-500'}`}>
                {emailResult.message}
              </p>
            )}
          </div>

          {/* Shared With Section */}
          {(acceptedShares.length > 0 || pendingShares.length > 0) && (
            <>
              <div className="border-t border-border" />
              <div>
                <h3 className="text-sm font-medium text-charcoal mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-warm-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Shared With
                </h3>
                <ul className="space-y-2">
                  {[...acceptedShares, ...pendingShares].map((share) => (
                    <li
                      key={share.id}
                      className="flex items-center justify-between p-2 bg-cream rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {share.user.profile_image_url ? (
                          <img
                            src={share.user.profile_image_url}
                            alt=""
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-medium">
                            {share.user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <span className="text-sm font-medium text-charcoal">{share.user.name}</span>
                          {share.status === 'pending' && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">
                              pending
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveShare(share.user_id)}
                        disabled={removingUserId === share.user_id}
                        className="p-1 text-warm-gray hover:text-red-500 disabled:opacity-50 transition-colors"
                        title="Remove access"
                      >
                        {removingUserId === share.user_id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-500 border-t-transparent" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
