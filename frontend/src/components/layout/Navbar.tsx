'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import {
  Bell, Search, User, LogOut, Upload, Home, Calendar,
  Image, Settings, Menu, X, Camera, ChevronDown, Bookmark,
  Users, ShieldCheck, Lock, ScanFace,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const { unreadCount, fetchNotifications } = useNotificationStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);

  const canUpload = user && user.role !== 'VIEWER' && user.role !== 'CLUB_MEMBER';

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user, fetchNotifications]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
    router.refresh();
  };

  const navLinks = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/events', label: 'Events', icon: Calendar },
    { href: '/gallery', label: 'Gallery', icon: Image },
    ...(user
      ? [
          { href: '/favourites', label: 'Favourites', icon: Bookmark },
          { href: '/my-photos', label: 'My Photos', icon: ScanFace },
        ]
      : []),
  ];

  return (
    <nav
      className={clsx(
        'sticky top-0 z-50 glass transition-all duration-300',
        scrolled
          ? 'shadow-[0_4px_16px_rgba(42,39,36,0.08)]'
          : ''
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <div className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center transition-colors duration-200 group-hover:bg-primary-700">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-base gradient-text hidden sm:block tracking-tight">
              EventMedia
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-0.5">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150',
                    active
                      ? 'nav-active'
                      : 'text-slate-500 hover:text-[#2a2724] hover:bg-[#f0ede8]'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="hidden md:flex items-center">
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-600 transition-colors" />
              <input
                type="text"
                placeholder="Search media, events…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#f4f1ec] border border-[#e0dbd2] hover:bg-white hover:border-[#cfc9be] focus:bg-white focus:border-primary-600
                           text-sm text-[#3a3631] rounded-full pl-10 pr-4 py-2 w-56 focus:w-72 transition-all duration-300
                           focus:outline-none focus:ring-2 focus:ring-primary-500/25 placeholder-slate-500 shadow-inner"
              />
            </div>
          </form>

          {/* Right Side */}
          <div className="flex items-center gap-1.5">
            {user ? (
              <>
                {canUpload && (
                  <Link
                    href="/upload"
                    className="btn-primary text-sm py-1.5 px-3 hidden sm:flex"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span className="hidden lg:block">Upload</span>
                  </Link>
                )}

                {/* Notifications */}
                <Link
                  href="/notifications"
                  className="relative p-2 hover:bg-[#f0ede8] rounded-xl transition-all duration-150"
                >
                  <Bell className="w-4.5 h-4.5 text-slate-500 hover:text-[#4a4540] transition-colors" style={{width:'18px',height:'18px'}} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-bold px-0.5 shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>

                {/* Profile Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 p-1.5 hover:bg-[#f0ede8] rounded-xl transition-all duration-150"
                  >
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.fullName}
                        className="w-7 h-7 rounded-lg object-cover ring-1 ring-[#e7e3dd]"
                      />
                    ) : (
                      <div className="w-7 h-7 bg-primary-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">
                        {user.fullName[0]}
                      </div>
                    )}
                    <ChevronDown
                      className={clsx(
                        'w-3 h-3 text-slate-500 hidden sm:block transition-transform duration-200',
                        profileOpen && 'rotate-180'
                      )}
                    />
                  </button>

                  <AnimatePresence>
                    {profileOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setProfileOpen(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.96 }}
                          transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
                          className="glass-panel absolute right-0 top-11 w-56 z-50 overflow-hidden"
                        >
                          {/* User info */}
                          <div className="px-4 py-3 border-b border-[#e7e3dd]">
                            <p className="font-semibold text-sm text-[#2a2724]">{user.fullName}</p>
                            <p className="text-xs text-slate-500 mt-0.5">@{user.username}</p>
                            <span className="mt-2 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary-500/10 text-primary-400 border border-primary-500/20">
                              {user.role === 'CLUB_MEMBER' && !user.isApproved
                                ? 'Pending Approval'
                                : user.role}
                            </span>
                          </div>

                          <div className="py-1.5">
                            {[
                              { href: '/profile', icon: User, label: 'Profile' },
                              { href: '/settings', icon: Settings, label: 'Settings' },
                            ].map(({ href, icon: Icon, label }) => (
                              <Link
                                key={href}
                                href={href}
                                onClick={() => setProfileOpen(false)}
                                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-400 hover:text-[#2a2724] hover:bg-[#f0ede8] transition-all duration-150"
                              >
                                <Icon className="w-4 h-4" /> {label}
                              </Link>
                            ))}

                            {user.role === 'ADMIN' && (
                              <>
                                <div className="border-t border-[#e7e3dd] my-1.5" />
                                <Link href="/users" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-primary-400 hover:text-primary-300 hover:bg-[#f0ede8] transition-all duration-150">
                                  <Users className="w-4 h-4" /> Manage Users
                                </Link>
                                <Link href="/admin/access-requests" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-primary-400 hover:text-primary-300 hover:bg-[#f0ede8] transition-all duration-150">
                                  <ShieldCheck className="w-4 h-4" /> Access Requests
                                </Link>
                              </>
                            )}

                            {user.role === 'PHOTOGRAPHER' && (
                              <>
                                <div className="border-t border-[#e7e3dd] my-1.5" />
                                <Link href="/my-access-requests" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-primary-400 hover:text-primary-300 hover:bg-[#f0ede8] transition-all duration-150">
                                  <Lock className="w-4 h-4" /> My Access Requests
                                </Link>
                              </>
                            )}

                            <div className="border-t border-[#e7e3dd] my-1.5" />
                            <button
                              onClick={() => { setProfileOpen(false); handleLogout(); }}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-[#f0ede8] transition-all duration-150 w-full"
                            >
                              <LogOut className="w-4 h-4" /> Sign Out
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="btn-secondary text-sm py-1.5">
                  Sign In
                </Link>
                <Link href="/register" className="btn-primary text-sm py-1.5 hidden sm:flex">
                  Sign Up
                </Link>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 hover:bg-[#f0ede8] rounded-xl transition-all duration-150"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="md:hidden border-t border-[#e7e3dd] overflow-hidden"
            >
              <div className="py-3 space-y-0.5">
                <form onSubmit={handleSearch} className="px-2 mb-3">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="input pl-9 text-sm"
                    />
                  </div>
                </form>

                {navLinks.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={clsx(
                      'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                      pathname === href
                        ? 'nav-active'
                        : 'text-slate-500 hover:text-[#2a2724] hover:bg-[#f0ede8]'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                ))}

                {canUpload && (
                  <Link href="/upload" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-primary-400 hover:bg-[#f0ede8] transition-all">
                    <Upload className="w-4 h-4" /> Upload
                  </Link>
                )}

                {user?.role === 'ADMIN' && (
                  <Link href="/admin/access-requests" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-primary-400 hover:bg-[#f0ede8] transition-all">
                    <ShieldCheck className="w-4 h-4" /> Access Requests
                  </Link>
                )}

                {user?.role === 'PHOTOGRAPHER' && (
                  <Link href="/my-access-requests" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-primary-400 hover:bg-[#f0ede8] transition-all">
                    <Lock className="w-4 h-4" /> My Access Requests
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
