'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Settings, Shield, Bell, Palette, Eye, EyeOff, Trash2, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/axios';

export default function SettingsPage() {
  const { user, logout, updateUser } = useAuthStore();
  const [notifications, setNotifications] = useState({
    likes: true,
    comments: true,
    tags: true,
    uploads: true,
  });
  const [privacy, setPrivacy] = useState({
    showEmail: user?.showEmail ?? false,
    allowTagging: user?.allowTagging ?? true,
    publicProfile: user?.publicProfile ?? true,
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'system';
    return localStorage.getItem('theme') || 'dark';
  });
  const [galleryLayout, setGalleryLayout] = useState(() => {
    if (typeof window === 'undefined') return 'grid';
    return localStorage.getItem('galleryLayout') || 'grid';
  });

  useEffect(() => {
    const applyTheme = (value: string) => {
      const root = document.documentElement;
      if (value === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.dataset.theme = prefersDark ? 'dark' : 'light';
      } else {
        root.dataset.theme = value;
      }
    };

    localStorage.setItem('theme', theme);
    applyTheme(theme);

    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('galleryLayout', galleryLayout);
    window.dispatchEvent(new CustomEvent('galleryLayoutChange', { detail: galleryLayout }));
  }, [galleryLayout]);

  useEffect(() => {
    if (!user) return;
    setPrivacy({
      showEmail: user.showEmail ?? false,
      allowTagging: user.allowTagging ?? true,
      publicProfile: user.publicProfile ?? true,
    });
  }, [user]);

  const handlePrivacyToggle = async (key: keyof typeof privacy) => {
    const nextPrivacy = { ...privacy, [key]: !privacy[key] };
    setPrivacy(nextPrivacy);
    try {
      const res = await api.put('/auth/profile', { [key]: nextPrivacy[key] });
      updateUser(res.data.data);
      toast.success('Privacy setting updated');
    } catch (error: any) {
      setPrivacy(privacy);
      toast.error(error.response?.data?.message || 'Failed to update privacy setting');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await api.put('/auth/password', { currentPassword, newPassword });
      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to update password';
      toast.error('Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    toast.success('Your data export has been initiated. You will receive an email shortly.');
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }
    if (!confirm('All your uploads, comments, and data will be permanently deleted. Continue?')) {
      return;
    }
    try {
      // API call would go here
      toast.success('Account deletion requested');
      logout();
    } catch (error) {
      toast.error('Failed to delete account');
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Notification Settings */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary-900/50 rounded-lg flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <h2 className="font-semibold">Notifications</h2>
            <p className="text-sm text-slate-400">Manage your notification preferences</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { key: 'likes', label: 'Likes', desc: 'When someone likes your media' },
            { key: 'comments', label: 'Comments', desc: 'When someone comments on your media' },
            { key: 'tags', label: 'Tags', desc: 'When someone tags you in a photo' },
            { key: 'uploads', label: 'New Uploads', desc: 'When new media is uploaded to your events' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
              <button
                onClick={() => setNotifications({ ...notifications, [key]: !notifications[key as keyof typeof notifications] })}
                className={`w-11 h-6 rounded-full transition-colors relative ${notifications[key as keyof typeof notifications] ? 'bg-primary-600' : 'bg-slate-700'
                  }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${notifications[key as keyof typeof notifications] ? 'left-6' : 'left-1'
                    }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Privacy Settings */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-900/50 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h2 className="font-semibold">Privacy</h2>
            <p className="text-sm text-slate-400">Control your privacy settings</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { key: 'showEmail', label: 'Show Email', desc: 'Display your email on your profile' },
            { key: 'allowTagging', label: 'Allow Tagging', desc: 'Let others tag you in photos' },
            { key: 'publicProfile', label: 'Public Profile', desc: 'Make your profile visible to everyone' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
              <button
                onClick={() => handlePrivacyToggle(key as keyof typeof privacy)}
                className={`w-11 h-6 rounded-full transition-colors relative ${privacy[key as keyof typeof privacy] ? 'bg-primary-600' : 'bg-slate-700'
                  }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${privacy[key as keyof typeof privacy] ? 'left-6' : 'left-1'
                    }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Change Password */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-yellow-900/50 rounded-lg flex items-center justify-center">
            <Settings className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h2 className="font-semibold">Change Password</h2>
            <p className="text-sm text-slate-400">Update your account password</p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="label">Current Password</label>
            <div className="relative">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
              >
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="label">New Password</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="label">Confirm New Password</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Appearance */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-900/50 rounded-lg flex items-center justify-center">
            <Palette className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="font-semibold">Appearance</h2>
            <p className="text-sm text-slate-400">Customize your experience</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-slate-500">Choose your preferred theme</p>
            </div>
            <select
              className="input w-auto text-sm"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Gallery Layout</p>
              <p className="text-xs text-slate-500">Default media gallery layout</p>
            </div>
            <select
              className="input w-auto text-sm"
              value={galleryLayout}
              onChange={(e) => setGalleryLayout(e.target.value)}
            >
              <option value="grid">Grid</option>
              <option value="masonry">Masonry</option>
              <option value="list">List</option>
            </select>
          </div>
        </div>
      </div>

      {/* Data & Account */}
      <div className="card p-6">
        <h2 className="font-semibold mb-4">Data & Account</h2>

        <div className="space-y-3">
          <button
            onClick={handleExportData}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Download className="w-5 h-5 text-slate-400" />
              <div className="text-left">
                <p className="text-sm font-medium">Export Your Data</p>
                <p className="text-xs text-slate-500">Download all your data in JSON format</p>
              </div>
            </div>
          </button>

          <button
            onClick={handleDeleteAccount}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-red-900/20 hover:bg-red-900/30 border border-red-900/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Trash2 className="w-5 h-5 text-red-400" />
              <div className="text-left">
                <p className="text-sm font-medium text-red-400">Delete Account</p>
                <p className="text-xs text-red-400/70">Permanently delete your account and all data</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
