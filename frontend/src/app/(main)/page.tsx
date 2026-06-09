'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/axios';
import { Event, Media } from '@/types';
import {
  Calendar, Image, Users, ArrowRight, Pencil, Sparkles,
  Compass, Heart, ScanFace, FolderOpen,
} from 'lucide-react';
import { motion } from 'framer-motion';
import MediaCard from '@/components/media/MediaCard';
import EventCard from '@/components/events/EventCard';
import ClubSetupModal from '@/components/admin/ClubSetupModal';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.25, 0.1, 0.25, 1] },
});

export default function HomePage() {
  const { user } = useAuthStore();
  const [recentMedia, setRecentMedia] = useState<Media[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState({ media: 0, events: 0, albums: 0, users: 0 });
  const [topLiked, setTopLiked] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [clubName, setClubName] = useState<string | null>(null);
  const [showClubSetup, setShowClubSetup] = useState(false);

  const canUpload = user && user.role !== 'VIEWER' && user.role !== 'CLUB_MEMBER';
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [mediaRes, eventsRes, analyticsRes, settingsRes] = await Promise.all([
          api.get('/media?limit=8&sortBy=createdAt&sortOrder=desc'),
          api.get('/events?limit=6'),
          api.get('/media/analytics').catch(() => ({ data: { data: { totals: { media: 0, events: 0, albums: 0, users: 0 } } } })),
          api.get('/settings/club').catch(() => ({ data: { data: { clubName: null, isConfigured: false } } })),
        ]);
        setRecentMedia(mediaRes.data.data || []);
        setEvents(eventsRes.data.data || []);
        const analytics = analyticsRes.data?.data;
        if (analytics?.totals) setStats(analytics.totals);
        if (analytics?.topLiked) setTopLiked(analytics.topLiked);
        const fetchedClubName: string | null = settingsRes.data?.data?.clubName || null;
        setClubName(fetchedClubName);
        if (isAdmin && !fetchedClubName) setShowClubSetup(true);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id, isAdmin]);

  const handleClubSetupComplete = (name: string) => {
    setClubName(name);
    setShowClubSetup(false);
  };

  // Compact stat tiles shown inside the hero's right panel.
  const heroStats = [
    { label: 'Members', value: stats.users, icon: Users },
    { label: 'Events', value: stats.events, icon: Calendar },
    { label: 'Albums', value: stats.albums, icon: FolderOpen },
    { label: 'Media', value: stats.media, icon: Image },
  ];

  const firstName = user?.fullName?.split(' ')[0] || 'there';

  return (
    <div className="space-y-10">
      {showClubSetup && (
        <ClubSetupModal
          onComplete={handleClubSetupComplete}
          onDismiss={() => setShowClubSetup(false)}
        />
      )}

      {/* Hero Section */}
      <motion.section
        {...fadeUp(0)}
        className="hero-surface p-8 md:p-12"
      >
        {/* Soft teal wash — gives the warm-paper hero presence without the
            dark-theme grid/orbs that rendered invisibly on white. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(60% 80% at 0% 0%, rgba(22,112,107,0.10) 0%, transparent 60%),' +
              'radial-gradient(50% 70% at 100% 100%, rgba(22,112,107,0.06) 0%, transparent 60%)',
          }}
        />

        <div className="relative z-10 grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
          {/* Left — greeting + title + CTAs */}
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-100 text-primary-700 text-sm font-semibold mb-5">
              <Sparkles className="w-4 h-4" />
              {user ? `Welcome back, ${firstName}` : 'Your club’s media hub'}
            </div>

            {loading ? (
              <div className="h-14 md:h-20 w-72 skeleton mb-4" />
            ) : (
              <motion.div {...fadeUp(0.05)} className="flex items-center gap-3 mb-4 flex-wrap">
                <h1 className="hero-title text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[0.95]">
                  {clubName || 'Event Media'}
                </h1>
                {isAdmin && (
                  <button
                    onClick={() => setShowClubSetup(true)}
                    title={clubName ? 'Edit club name' : 'Set club name'}
                    className="p-2 rounded-xl text-slate-500 hover:text-primary-600 hover:bg-[#f0ede8] transition-colors flex-shrink-0"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                )}
              </motion.div>
            )}

            <p className="hero-subtitle text-base md:text-lg mb-7 max-w-lg leading-relaxed">
              {user
                ? "Here's what's new across your club's events and galleries — relive the moments, find your photos, and keep everyone connected."
                : 'A centralized platform for club & event photos and videos — every moment, organized and searchable in one place.'}
            </p>

            <div className="flex flex-wrap gap-3">
              {user ? (
                <>
                  <Link href="/events" className="btn-primary">
                    <Compass className="w-4 h-4" />
                    Explore Events
                  </Link>
                  <Link href="/my-photos" className="btn-secondary">
                    <ScanFace className="w-4 h-4" />
                    Find My Photos
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/register" className="btn-primary">Get Started</Link>
                  <Link href="/gallery" className="btn-secondary">Browse Gallery</Link>
                </>
              )}
            </div>

            {/* Quick highlights — fill the left column so the hero doesn't feel empty */}
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2">
                <ScanFace className="w-4 h-4 text-primary-600" />
                AI photo finder
              </span>
              <span className="inline-flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-primary-600" />
                Organized albums
              </span>
              <span className="inline-flex items-center gap-2">
                <Heart className="w-4 h-4 text-primary-600" />
                Like &amp; save favourites
              </span>
            </div>
          </div>

          {/* Right — live stat panel (fills the previously-empty hero space) */}
          <motion.div
            {...fadeUp(0.12)}
            className="hidden lg:block rounded-2xl border border-[#e7e3dd] bg-gradient-to-br from-white to-[#f7f5f1] p-6 shadow-[0_8px_30px_rgba(42,39,36,0.08)] ring-1 ring-black/[0.02]"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">At a glance</p>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-primary-700">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
                Live
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {heroStats.map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-xl border border-[#e7e3dd] bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-extrabold tracking-tight text-[#2a2724]">
                      {loading ? '—' : value.toLocaleString()}
                    </span>
                    <span className="w-8 h-8 rounded-lg bg-primary-50 border border-primary-100 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-primary-600" />
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 font-medium">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-primary-50 border border-primary-100 px-3.5 py-2.5">
              <ScanFace className="w-4 h-4 text-primary-600 flex-shrink-0" />
              <p className="text-xs text-primary-700 font-medium leading-tight">
                AI face recognition finds your photos automatically
              </p>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Trending / Most Liked */}
      {topLiked.length > 0 && (
        <motion.section {...fadeUp(0.1)}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Trending Now</h2>
                <p className="text-xs text-slate-600 mt-0.5">Most-liked photos across all events</p>
              </div>
            </div>
            <Link href="/gallery" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary-400 transition-colors duration-150 group">
              View All
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {topLiked.map((media, i) => (
              <motion.div
                key={media.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="relative group"
              >
                <Link href={`/media/${media.id}`} className="block relative">
                  <MediaCard media={media} />
                  {/* Rank badge */}
                  <span className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm border border-[#e7e3dd] text-[11px] font-bold text-primary-700 flex items-center justify-center shadow-sm">
                    {i + 1}
                  </span>
                  {/* Like count badge */}
                  <span className="absolute bottom-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-[11px] font-semibold">
                    <Heart className="w-3 h-3 fill-red-500 text-red-500" />
                    {media._count?.likes ?? 0}
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Events */}
      <motion.section {...fadeUp(0.1)}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Recent Events</h2>
            <p className="text-xs text-slate-600 mt-0.5">Browse upcoming and past events</p>
          </div>
          <Link href="/events" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary-400 transition-colors duration-150 group">
            View All
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((event, i) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <EventCard event={event} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 card">
            <div className="w-14 h-14 bg-[#f0ede8] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-7 h-7 text-slate-600" />
            </div>
            <p className="text-slate-700 font-medium">No events yet</p>
            <p className="text-slate-500 text-sm mt-1">Events will appear here once created</p>
          </div>
        )}
      </motion.section>

      {/* Recent Media */}
      <motion.section {...fadeUp(0.15)}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Recent Uploads</h2>
            <p className="text-xs text-slate-600 mt-0.5">Latest photos and videos</p>
          </div>
          <Link href="/gallery" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary-400 transition-colors duration-150 group">
            View All
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square skeleton" />
            ))}
          </div>
        ) : recentMedia.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {recentMedia.map((media, i) => (
              <motion.div
                key={media.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link href={`/media/${media.id}`}>
                  <MediaCard media={media} />
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 card">
            <div className="w-14 h-14 bg-[#f0ede8] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Image className="w-7 h-7 text-slate-600" />
            </div>
            <p className="text-slate-700 font-medium">No media uploaded yet</p>
            <p className="text-slate-500 text-sm mt-1">Start by uploading your first photo</p>
          </div>
        )}
      </motion.section>
    </div>
  );
}
