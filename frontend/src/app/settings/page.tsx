'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { useStore } from '@/store/useStore';
import Navbar from '@/components/layout/Navbar';
import MobileNavWrapper from '@/components/layout/MobileNavWrapper';
import type { UserSettings } from '@/types';

export default function SettingsPage() {
  const router = useRouter();
  const { user, fetchUserProfile, logout } = useStore();

  // Profile form
  const [profileForm, setProfileForm] = useState({
    name: '',
    username: '',
    bio: '',
    is_public: false,
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');

  // Preferences form
  const [prefsForm, setPrefsForm] = useState({
    preferred_unit_system: 'metric' as 'metric' | 'imperial',
    default_servings: 4,
  });
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsMessage, setPrefsMessage] = useState('');

  // Notifications form
  const [notifForm, setNotifForm] = useState({
    email_new_follower: true,
    email_follow_request: true,
    email_recipe_saved: false,
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMessage, setNotifMessage] = useState('');

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        username: user.username || '',
        bio: user.bio || '',
        is_public: user.is_public || false,
      });
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      const settings = await authApi.getSettings();
      setPrefsForm({
        preferred_unit_system: settings.preferred_unit_system,
        default_servings: settings.default_servings,
      });
      setNotifForm({
        email_new_follower: settings.email_new_follower,
        email_follow_request: settings.email_follow_request,
        email_recipe_saved: settings.email_recipe_saved,
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMessage('');

    try {
      await authApi.updateUserProfile({
        name: profileForm.name,
        username: profileForm.username,
        bio: profileForm.bio || undefined,
        is_public: profileForm.is_public,
      });
      await fetchUserProfile();
      setProfileMessage('Profile updated successfully');
      setTimeout(() => setProfileMessage(''), 3000);
    } catch (error: any) {
      setProfileMessage(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePrefsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrefsSaving(true);
    setPrefsMessage('');

    try {
      await authApi.updateSettings({
        preferred_unit_system: prefsForm.preferred_unit_system,
        default_servings: prefsForm.default_servings,
      });
      setPrefsMessage('Preferences saved');
      setTimeout(() => setPrefsMessage(''), 3000);
    } catch (error: any) {
      setPrefsMessage(error.response?.data?.detail || 'Failed to save preferences');
    } finally {
      setPrefsSaving(false);
    }
  };

  const handleNotifSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotifSaving(true);
    setNotifMessage('');

    try {
      await authApi.updateSettings({
        email_new_follower: notifForm.email_new_follower,
        email_follow_request: notifForm.email_follow_request,
        email_recipe_saved: notifForm.email_recipe_saved,
      });
      setNotifMessage('Notification settings saved');
      setTimeout(() => setNotifMessage(''), 3000);
    } catch (error: any) {
      setNotifMessage(error.response?.data?.detail || 'Failed to save');
    } finally {
      setNotifSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordMessage('');

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordForm.new_password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    setPasswordSaving(true);

    try {
      await authApi.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setPasswordMessage('Password changed successfully');
      setTimeout(() => setPasswordMessage(''), 3000);
    } catch (error: any) {
      setPasswordError(error.response?.data?.detail || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;

    setDeleting(true);
    try {
      await authApi.deleteAccount();
      logout();
      router.push('/login');
    } catch (error) {
      console.error('Failed to delete account:', error);
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream has-bottom-nav">
      <Navbar />
      <MobileNavWrapper />

      <main className="max-w-2xl mx-auto px-4 md:px-8 py-8">
        <div className="mb-8">
          <h1 className="font-serif text-4xl text-charcoal">Settings</h1>
          <p className="text-warm-gray mt-2">Manage your account and preferences</p>
        </div>

        <div className="space-y-8">
          {/* Profile Section */}
          <section className="card">
            <h2 className="font-serif text-2xl text-charcoal mb-6">Profile</h2>

            <form onSubmit={handleProfileSubmit} className="space-y-5">
              <div>
                <label className="label mb-2 block">Name</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="input-field w-full"
                />
              </div>

              <div>
                <label className="label mb-2 block">Username</label>
                <div className="flex items-center">
                  <span className="text-warm-gray mr-1">@</span>
                  <input
                    type="text"
                    value={profileForm.username}
                    onChange={e => setProfileForm({ ...profileForm, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    className="input-field flex-1"
                    placeholder="username"
                  />
                </div>
                <p className="text-sm text-warm-gray mt-1">
                  Your profile URL: potatoes.app/@{profileForm.username || 'username'}
                </p>
              </div>

              <div>
                <label className="label mb-2 block">Bio</label>
                <textarea
                  value={profileForm.bio}
                  onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })}
                  rows={3}
                  className="input-field w-full"
                  placeholder="Tell us about yourself..."
                />
              </div>

              <div>
                <label className="label mb-2 block">Privacy</label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={profileForm.is_public}
                    onChange={e => setProfileForm({ ...profileForm, is_public: e.target.checked })}
                    className="w-5 h-5 accent-gold"
                  />
                  <span className="text-charcoal">Make my profile public</span>
                </label>
                <p className="text-sm text-warm-gray mt-1 ml-8">
                  Public profiles can be found by other users and your public recipes will appear in the feed.
                </p>
              </div>

              {profileMessage && (
                <p className={`text-sm ${profileMessage.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                  {profileMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={profileSaving}
                className="btn-primary disabled:opacity-50"
              >
                {profileSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          </section>

          {/* Preferences Section */}
          <section className="card">
            <h2 className="font-serif text-2xl text-charcoal mb-6">Preferences</h2>

            <form onSubmit={handlePrefsSubmit} className="space-y-5">
              <div>
                <label className="label mb-2 block">Measurement Units</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="unit_system"
                      value="metric"
                      checked={prefsForm.preferred_unit_system === 'metric'}
                      onChange={() => setPrefsForm({ ...prefsForm, preferred_unit_system: 'metric' })}
                      className="w-4 h-4 accent-gold"
                    />
                    <span className="text-charcoal">Metric (g, ml, kg)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="unit_system"
                      value="imperial"
                      checked={prefsForm.preferred_unit_system === 'imperial'}
                      onChange={() => setPrefsForm({ ...prefsForm, preferred_unit_system: 'imperial' })}
                      className="w-4 h-4 accent-gold"
                    />
                    <span className="text-charcoal">Imperial (oz, cups, lbs)</span>
                  </label>
                </div>
                <p className="text-sm text-warm-gray mt-1">
                  This affects how ingredients are displayed when possible.
                </p>
              </div>

              <div>
                <label className="label mb-2 block">Default Servings</label>
                <select
                  value={prefsForm.default_servings}
                  onChange={e => setPrefsForm({ ...prefsForm, default_servings: parseInt(e.target.value) })}
                  className="input-field w-32"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map(n => (
                    <option key={n} value={n}>{n} servings</option>
                  ))}
                </select>
                <p className="text-sm text-warm-gray mt-1">
                  Default serving size when creating new recipes.
                </p>
              </div>

              {prefsMessage && (
                <p className={`text-sm ${prefsMessage.includes('saved') ? 'text-green-600' : 'text-red-600'}`}>
                  {prefsMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={prefsSaving}
                className="btn-primary disabled:opacity-50"
              >
                {prefsSaving ? 'Saving...' : 'Save Preferences'}
              </button>
            </form>
          </section>

          {/* Notifications Section */}
          <section className="card">
            <h2 className="font-serif text-2xl text-charcoal mb-6">Email Notifications</h2>

            <form onSubmit={handleNotifSubmit} className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifForm.email_new_follower}
                  onChange={e => setNotifForm({ ...notifForm, email_new_follower: e.target.checked })}
                  className="w-5 h-5 accent-gold"
                />
                <div>
                  <span className="text-charcoal">New followers</span>
                  <p className="text-sm text-warm-gray">Get notified when someone starts following you</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifForm.email_follow_request}
                  onChange={e => setNotifForm({ ...notifForm, email_follow_request: e.target.checked })}
                  className="w-5 h-5 accent-gold"
                />
                <div>
                  <span className="text-charcoal">Follow requests</span>
                  <p className="text-sm text-warm-gray">Get notified when someone requests to follow you</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifForm.email_recipe_saved}
                  onChange={e => setNotifForm({ ...notifForm, email_recipe_saved: e.target.checked })}
                  className="w-5 h-5 accent-gold"
                />
                <div>
                  <span className="text-charcoal">Recipe interactions</span>
                  <p className="text-sm text-warm-gray">Get notified when someone saves your recipe</p>
                </div>
              </label>

              {notifMessage && (
                <p className={`text-sm ${notifMessage.includes('saved') ? 'text-green-600' : 'text-red-600'}`}>
                  {notifMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={notifSaving}
                className="btn-primary disabled:opacity-50"
              >
                {notifSaving ? 'Saving...' : 'Save Notification Settings'}
              </button>
            </form>
          </section>

          {/* Email Section */}
          <section className="card">
            <h2 className="font-serif text-2xl text-charcoal mb-6">Email</h2>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-charcoal">{user?.email}</p>
                <p className="text-sm text-warm-gray">
                  {user?.is_verified ? 'Verified' : 'Not verified'}
                </p>
              </div>
              {!user?.is_verified && (
                <button
                  onClick={() => authApi.resendVerification(user?.email || '')}
                  className="text-gold hover:text-gold-dark text-sm"
                >
                  Resend verification
                </button>
              )}
            </div>
          </section>

          {/* Password Section */}
          <section className="card">
            <h2 className="font-serif text-2xl text-charcoal mb-6">Change Password</h2>

            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              <div>
                <label className="label mb-2 block">Current Password</label>
                <input
                  type="password"
                  value={passwordForm.current_password}
                  onChange={e => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                  className="input-field w-full"
                />
              </div>

              <div>
                <label className="label mb-2 block">New Password</label>
                <input
                  type="password"
                  value={passwordForm.new_password}
                  onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  className="input-field w-full"
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label className="label mb-2 block">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={e => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  className="input-field w-full"
                />
              </div>

              {passwordError && (
                <p className="text-sm text-red-600">{passwordError}</p>
              )}
              {passwordMessage && (
                <p className="text-sm text-green-600">{passwordMessage}</p>
              )}

              <button
                type="submit"
                disabled={passwordSaving || !passwordForm.current_password || !passwordForm.new_password}
                className="btn-primary disabled:opacity-50"
              >
                {passwordSaving ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </section>

          {/* Danger Zone */}
          <section className="card border-red-200">
            <h2 className="font-serif text-2xl text-red-600 mb-4">Danger Zone</h2>
            <p className="text-warm-gray mb-4">
              Once you delete your account, there is no going back. All your recipes, collections, and data will be permanently deleted.
            </p>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="btn-danger"
              >
                Delete Account
              </button>
            ) : (
              <div className="space-y-4">
                <p className="text-charcoal">
                  Type <strong>DELETE</strong> to confirm:
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  className="input-field w-full"
                  placeholder="DELETE"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText('');
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== 'DELETE' || deleting}
                    className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-5 rounded-full transition-all uppercase tracking-wide text-sm disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Delete My Account'}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
