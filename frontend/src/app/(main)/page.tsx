'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/axios';
import { Event, Media } from '@/types';
import { Calendar, Image, Users, TrendingUp, ArrowRight, Camera, Pencil, Sparkles, Compass } from 'lucide-react';
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
        if (analyticsRes.data?.data?.totals) setStats(analyticsRes.data.data.totals);
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
        {/* Decorative grid lines */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Glow orb */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-primary-600/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          {loading ? (
            <div className="h-14 md:h-20 w-72 skeleton mb-3" />
          ) : (
            <motion.div {...fadeUp(0.05)} className="flex items-center gap-3 mb-3 flex-wrap">
              <h1 className="hero-title text-4xl md:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-none">
                {clubName || 'Event Media'}
              </h1>
              {isAdmin && (
                <button
                  onClick={() => setShowClubSetup(true)}
                  title={clubName ? 'Edit club name' : 'Set club name'}
                  className="p-2 rounded-xl text-slate-400 hover:text-primary-600 hover:bg-[#f0ede8] transition-colors flex-shrink-0"
                >
                  <Pencil className="w-5 h-5" />
                </button>
              )}
            </motion.div>
          )}

          <p className="hero-subtitle text-slate-500 text-base md:text-lg mb-8 max-w-md">
            {user
              ? `Welcome back, ${user.fullName.split(' ')[0]}! Your club's media hub is ready.`
              : 'A centralized platform for club & event photos and videos.'}
          </p>

          <div className="flex flex-wrap gap-3">
            {user ? (
              <>
                <Link href="/events" className="btn-primary">
                  <Compass className="w-4 h-4" />
                  Explore Events
                </Link>
                <Link href="/my-photos" className="btn-secondary">
                  <Sparkles className="w-4 h-4" />
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
        </div>
      </motion.section>

      {/* Stats */}
      <motion.section {...fadeUp(0.05)} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Photos & Videos', value: stats.media, icon: Image, color: 'text-primary-400', bg: 'bg-primary-500/8', glow: 'rgba(22, 112, 107,0.15)' },
          { label: 'Events', value: stats.events, icon: Calendar, color: 'text-emerald-600', bg: 'bg-emerald-500/8', glow: 'rgba(16,185,129,0.15)' },
          { label: 'Albums', value: stats.albums, icon: TrendingUp, color: 'text-primary-400', bg: 'bg-primary-500/8', glow: 'rgba(22, 112, 107,0.15)' },
          { label: 'Members', value: stats.users, icon: Users, color: 'text-amber-400', bg: 'bg-amber-500/8', glow: 'rgba(245,158,11,0.15)' },
        ].map(({ label, value, icon: Icon, color, bg }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.08 + i * 0.05, duration: 0.3 }}
            className="card p-5 flex flex-col gap-3"
          >
            <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center`}>
              <Icon className={`w-4.5 h-4.5 ${color}`} style={{width:'18px',height:'18px'}} />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">{loading ? '—' : value.toLocaleString()}</p>
              <p className="text-xs text-slate-600 mt-0.5 font-medium">{label}</p>
            </div>
          </motion.div>
        ))}
      </motion.section>

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
            <p className="text-slate-500 font-medium">No events yet</p>
            <p className="text-slate-700 text-sm mt-1">Events will appear here once created</p>
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
            <p className="text-slate-500 font-medium">No media uploaded yet</p>
            <p className="text-slate-700 text-sm mt-1">Start by uploading your first photo</p>
          </div>
        )}
      </motion.section>
    </div>
  );
}
