'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/axios';
import { Event, Media } from '@/types';
import { Calendar, Image, Users, TrendingUp, ArrowRight, Camera, Pencil } from 'lucide-react';
import { motion } from 'framer-motion';
import MediaCard from '@/components/media/MediaCard';
import EventCard from '@/components/events/EventCard';
import ClubSetupModal from '@/components/admin/ClubSetupModal';

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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="hero-surface relative overflow-hidden rounded-2xl p-8 md:p-12"
      >
        <div className="relative z-10">
          {/* Club name — the biggest thing on the page */}
          {clubName ? (
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="hero-title text-4xl md:text-6xl lg:text-7xl font-extrabold text-white mb-3 tracking-tight"
            >
              {clubName}
            </motion.h1>
          ) : (
            <h1 className="hero-title text-4xl md:text-6xl lg:text-7xl font-extrabold text-white mb-3 tracking-tight">
              Event Media
            </h1>
          )}

          {/* Smaller welcome line */}
          <p className="hero-subtitle text-slate-400 text-base md:text-lg mb-6">
            {user ? `Welcome back, ${user.fullName.split(' ')[0]}!` : 'Sign in to get started'}
          </p>

          <div className="flex flex-wrap gap-3">
            {user ? (
              <>
                {canUpload && (
                  <Link href="/upload" className="btn-primary">
                    <Camera className="w-4 h-4" /> Upload Media
                  </Link>
                )}
                <Link href="/my-photos" className="btn-secondary">
                  Find My Photos
                </Link>
                {isAdmin && (
                  <button
                    onClick={() => setShowClubSetup(true)}
                    className="btn-secondary text-xs flex items-center gap-1.5 opacity-60 hover:opacity-100"
                  >
                    <Pencil className="w-3 h-3" />
                    {clubName ? 'Edit Club Name' : 'Set Club Name'}
                  </button>
                )}
              </>
            ) : (
              <>
                <Link href="/register" className="btn-primary">Get Started</Link>
                <Link href="/gallery" className="btn-secondary">Browse Gallery</Link>
              </>
            )}
          </div>
        </div>
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-10">
          <div className="w-full h-full bg-gradient-to-l from-primary-500 to-transparent" />
        </div>
      </motion.section>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Photos & Videos', value: stats.media, icon: Image, color: 'text-blue-400' },
          { label: 'Events', value: stats.events, icon: Calendar, color: 'text-green-400' },
          { label: 'Albums', value: stats.albums, icon: TrendingUp, color: 'text-purple-400' },
          { label: 'Users', value: stats.users, icon: Users, color: 'text-orange-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card p-4 text-center"
          >
            <Icon className={`w-6 h-6 ${color} mx-auto mb-2`} />
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-slate-400">{label}</p>
          </motion.div>
        ))}
      </section>

      {/* Recent Media */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Recent Uploads</h2>
          <Link href="/gallery" className="text-primary-400 hover:text-primary-300 text-sm flex items-center gap-1">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square bg-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : recentMedia.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {recentMedia.map((media) => (
              <Link href={`/media/${media.id}`} key={media.id}>
                <MediaCard media={media} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 card">
            <Image className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No media uploaded yet</p>
          </div>
        )}
      </section>

      {/* Events */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Recent Events</h2>
          <Link href="/events" className="text-primary-400 hover:text-primary-300 text-sm flex items-center gap-1">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 card">
            <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No events created yet</p>
          </div>
        )}
      </section>
    </div>
  );
}
