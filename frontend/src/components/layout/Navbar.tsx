'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import {
Bell, Search, User, LogOut, Upload, Home, Calendar,
Image, Settings, Menu, X, Camera, ChevronDown, Bookmark,
Users, ShieldCheck, Lock,
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
const canUpload = user && user.role !== 'VIEWER' && user.role !== 'CLUB_MEMBER';
useEffect(() => {
if (user) fetchNotifications();
}, [user, fetchNotifications]);
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
{ href: '/my-photos', label: 'My Photos', icon: Camera },
]
: []),
];
return (
<nav className="sticky top-0 z-50 glass border-b border-slate-800/50">
<div className="max-w-7xl mx-auto px-4">
<div className="flex items-center justify-between h-16">
{/* Logo */}
<Link href="/" className="flex items-center gap-2 flex-shrink-0">
<div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-blue-600 rounded-lg flex items-center justify-center">
<Camera className="w-5 h-5 text-white" />
</div>
<span className="font-bold text-lg gradient-text hidden sm:block">
EventMedia
</span>
</Link>
{/* Desktop Nav Links */}
<div className="hidden md:flex items-center gap-1">
{navLinks.map(({ href, label, icon: Icon }) => (
<Link
key={href}
href={href}
className={clsx(
'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
pathname === href
? 'bg-primary-500/15 text-primary-400 ring-1 ring-primary-500/30'
: 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
)}
>
<Icon className="w-4 h-4" />
{label}
</Link>
))}
</div>
{/* Search */}
<form onSubmit={handleSearch} className="hidden md:flex items-center">
<div className="relative">
<Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
<input
type="text"
placeholder="Search media, events..."
value={searchQuery}
onChange={(e) => setSearchQuery(e.target.value)}
className="input bg-slate-800/50 border border-slate-700 text-sm text-slate-100
rounded-full pl-9 pr-4 py-1.5 w-48 focus:w-64 transition-all
focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder-slate-500"
/>
</div>
</form>
{/* Right Side */}
<div className="flex items-center gap-2">
{user ? (
<>
{canUpload && (
<Link
href="/upload"
className="btn-primary text-sm py-1.5 hidden sm:flex"
>
<Upload className="w-4 h-4" />
<span className="hidden lg:block">Upload</span>
</Link>
)}
{/* Notifications */}
<Link
href="/notifications"
className="relative p-2 hover:bg-white/5 rounded-lg transition-all duration-200"
>
<Bell className="w-5 h-5 text-slate-400" />
{unreadCount > 0 && (
<span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-bold">
{unreadCount > 9 ? '9+' : unreadCount}
</span>
)}
</Link>
{/* Profile Dropdown */}
<div className="relative">
<button
onClick={() => setProfileOpen(!profileOpen)}
className="flex items-center gap-2 p-1 hover:bg-white/5 rounded-lg transition-all duration-200"
>
{user.avatar ? (
<img
src={user.avatar}
alt={user.fullName}
className="w-7 h-7 rounded-full object-cover"
/>
) : (
<div className="w-7 h-7 bg-gradient-to-br from-primary-500 to-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
{user.fullName[0]}
</div>
)}
<ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
</button>
<AnimatePresence>
{profileOpen && (
<>
<div
className="fixed inset-0 z-40"
onClick={() => setProfileOpen(false)}
/>
<motion.div
initial={{ opacity: 0, y: 10, scale: 0.95 }}
animate={{ opacity: 1, y: 0, scale: 1 }}
exit={{ opacity: 0, y: 10, scale: 0.95 }}
transition={{ duration: 0.15 }}
className="absolute right-0 top-10 w-52 card shadow-xl border border-slate-700 py-1 z-50"
>
<div className="px-3 py-2 border-b border-slate-700">
<p className="font-medium text-sm">{user.fullName}</p>
<p className="text-xs text-slate-400">@{user.username}</p>
<span className="badge bg-primary-900/50 text-primary-400 text-[10px] mt-1 inline-block">
{user.role}
</span>
</div>
<Link
href="/profile"
onClick={() => setProfileOpen(false)}
className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 transition-all duration-200"
>
<User className="w-4 h-4" /> Profile
</Link>
<Link
href="/settings"
onClick={() => setProfileOpen(false)}
className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 transition-all duration-200"
>
<Settings className="w-4 h-4" /> Settings
</Link>
{user.role === 'ADMIN' && (
<>
<div className="border-t border-slate-700 my-1" />
<Link
href="/users"
onClick={() => setProfileOpen(false)}
className="flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:bg-white/5 transition-all duration-200"
>
<Users className="w-4 h-4" /> Manage Users
</Link>
<Link
href="/admin/access-requests"
onClick={() => setProfileOpen(false)}
className="flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:bg-white/5 transition-all duration-200"
>
<ShieldCheck className="w-4 h-4" /> Access Requests
</Link>
</>
)}
{user.role === 'PHOTOGRAPHER' && (
<>
<div className="border-t border-slate-700 my-1" />
<Link
href="/my-access-requests"
onClick={() => setProfileOpen(false)}
className="flex items-center gap-2 px-3 py-2 text-sm text-primary-400 hover:bg-white/5 transition-all duration-200"
>
<Lock className="w-4 h-4" /> My Access Requests
</Link>
</>
)}
<div className="border-t border-slate-700 my-1" />
<button
onClick={() => {
setProfileOpen(false);
handleLogout();
}}
className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-white/5 transition-all duration-200 w-full"
>
<LogOut className="w-4 h-4" /> Sign Out
</button>
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
<Link
href="/register"
className="btn-primary text-sm py-1.5 hidden sm:flex"
>
Sign Up
</Link>
</div>
)}
{/* Mobile Menu Toggle */}
<button
onClick={() => setMobileOpen(!mobileOpen)}
className="md:hidden p-2 hover:bg-white/5 rounded-lg"
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
className="md:hidden border-t border-slate-800 overflow-hidden"
>
<div className="py-3 space-y-1">
<form onSubmit={handleSearch} className="px-2 mb-3">
<div className="relative">
<Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
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
onClick={() => setMobileOpen(false)}
className={clsx(
'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
pathname === href
? 'bg-primary-500/15 text-primary-400 ring-1 ring-primary-500/30'
: 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
)}
>
<Icon className="w-4 h-4" />
{label}
</Link>
))}
{canUpload && (
<Link
href="/upload"
onClick={() => setMobileOpen(false)}
className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-primary-400 hover:bg-white/5"
>
<Upload className="w-4 h-4" /> Upload
</Link>
)}
{user?.role === 'ADMIN' && (
<Link
href="/admin/access-requests"
onClick={() => setMobileOpen(false)}
className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-blue-400 hover:bg-white/5"
>
<ShieldCheck className="w-4 h-4" /> Access Requests
</Link>
)}
{user?.role === 'PHOTOGRAPHER' && (
<Link
href="/my-access-requests"
onClick={() => setMobileOpen(false)}
className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-primary-400 hover:bg-white/5"
>
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