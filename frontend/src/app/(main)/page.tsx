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

  // The Trending grid shows the canonical top-liked photos…
  const TRENDING_COUNT = 5;
  const trendingMedia = topLiked.slice(0, TRENDING_COUNT);

  // …and the hero collage deliberately shows DIFFERENT photos so the two
  // sections don't repeat. Priority for the 4 collage tiles:
  //   1. the next-most-liked photos (ranks 6+) not already in Trending
  //   2. recent uploads that aren't in Trending (covers the case where there
  //      aren't enough liked photos to fill both sections)
  //   3. recent uploads (last resort, e.g. a brand-new club with <4 photos)
  const trendingIds = new Set(trendingMedia.map((m) => m.id));
  const collageMedia = (() => {
    const pool: Media[] = [];
    const seen = new Set<string>();
    // `respectTrending=false` lets the final fallback reuse Trending photos so a
    // tiny club (every photo already in Trending) still gets a populated hero.
    const add = (items: Media[], respectTrending = true) => {
      for (const m of items) {
        if (pool.length >= 4) break;
        if (seen.has(m.id) || (respectTrending && trendingIds.has(m.id))) continue;
        seen.add(m.id);
        pool.push(m);
      }
    };
    add(topLiked.slice(TRENDING_COUNT)); // ranks 6+ (never in Trending)
    add(recentMedia);                    // fresh, non-trending uploads
    if (pool.length === 0) add(recentMedia.length ? recentMedia : topLiked, false); // last resort
    return pool;
  })();

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

        <div className="relative z-10 grid lg:grid-cols-[1fr_1.05fr] gap-10 items-stretch">
          {/* Left — greeting + title + CTAs */}
          <div className="flex flex-col justify-center">
            <div className="self-start inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-100 text-primary-700 text-sm font-semibold mb-5">
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

            {/* Inline stats line — quick context directly under the title. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-normal text-slate-500 mb-5">
              {heroStats.map(({ label, value }, i) => (
                <span key={label} className="inline-flex items-center gap-2">
                  {i > 0 && <span className="text-slate-300">•</span>}
                  <span>
                    <span className="font-medium text-[#57514a]">{loading ? '—' : value.toLocaleString()}</span>{' '}
                    {label}
                  </span>
                </span>
              ))}
            </div>

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
          </div>

          {/* Right — photo collage: the hero's visual anchor, built from real
              media (top-liked, falling back to recent uploads). */}
          <motion.div {...fadeUp(0.12)} className="hidden lg:flex items-stretch">
            <HeroCollage media={collageMedia} loading={loading} />
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
            {trendingMedia.map((media, i) => (
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

/* ── Hero collage ────────────────────────────────────────────────────────
   An edge-to-edge mosaic of real media that anchors the hero. A 12×12 grid
   fills the entire column corner-to-corner (no dead white space), while a small
   overlap, white rings and a hairline tilt keep the premium layered-card feel.
   Falls back to a labelled placeholder when the club has no media yet. */
function HeroCollage({ media, loading }: { media: Media[]; loading: boolean }) {
  // Tile spans on a 12-col × 12-row grid. Together they tile the whole stage:
  // a tall feature on the left, a stacked pair on the right, and a wide footer.
  // The negative margins create a ~10px overlap so neighbours layer slightly.
  const tiles = [
    { area: '1 / 1 / 9 / 7',  rotate: '-1.5deg', z: 30, m: 'mr-[-10px] mb-[-10px]' }, // large feature (top-left)
    { area: '1 / 7 / 6 / 13', rotate: '1.5deg',  z: 20, m: 'mb-[-10px]' },            // top-right
    { area: '6 / 7 / 13 / 13', rotate: '-1deg',  z: 25, m: 'ml-[-10px]' },            // bottom-right (tall)
    { area: '9 / 1 / 13 / 7', rotate: '2deg',    z: 40, m: 'mt-[-10px]' },            // bottom-left (wide)
  ];

  const Stage = ({ children }: { children: React.ReactNode }) => (
    <div className="relative w-full h-[26rem]">
      {/* soft teal glow behind the mosaic for depth */}
      <div
        className="absolute -inset-3 -z-10 rounded-[2rem] blur-2xl opacity-60 pointer-events-none"
        style={{ background: 'radial-gradient(60% 60% at 50% 45%, rgba(22,112,107,0.18), transparent 70%)' }}
      />
      <div className="grid h-full w-full" style={{ gridTemplateColumns: 'repeat(12,1fr)', gridTemplateRows: 'repeat(12,1fr)' }}>
        {children}
      </div>
    </div>
  );

  if (loading) {
    return (
      <Stage>
        {tiles.map((t, i) => (
          <div
            key={i}
            className={`skeleton rounded-2xl ring-4 ring-white ${t.m}`}
            style={{ gridArea: t.area, zIndex: t.z }}
          />
        ))}
      </Stage>
    );
  }

  if (media.length === 0) {
    return (
      <div className="w-full h-[26rem] rounded-2xl border border-dashed border-[#d8d3ca] bg-gradient-to-br from-white to-[#f7f5f1] flex flex-col items-center justify-center text-center px-6">
        <span className="w-14 h-14 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center mb-3">
          <Image className="w-7 h-7 text-primary-600" />
        </span>
        <p className="text-sm font-semibold text-[#2a2724]">Your gallery starts here</p>
        <p className="text-xs text-slate-600 mt-1">Uploaded photos will showcase here automatically</p>
      </div>
    );
  }

  // Cycle photos so the mosaic stays full even with only 1–3 uploads.
  const stack = tiles.map((t, i) => ({ tile: t, m: media[i % media.length] }));

  return (
    <Stage>
      {stack.map(({ tile, m }, i) => (
        <motion.div
          key={`${m.id}-${i}`}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 + i * 0.08, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ gridArea: tile.area, zIndex: tile.z, rotate: tile.rotate }}
          className={`relative group ${tile.m}`}
        >
          <Link href={`/media/${m.id}`} className="block w-full h-full">
            {/* white ring + soft drop shadow make the overlap read as a stacked
                card; hover lifts the tile clear of the mosaic. */}
            <div className="w-full h-full rounded-2xl overflow-hidden bg-[#f0ede8] ring-4 ring-white shadow-[0_10px_30px_rgba(42,39,36,0.16)] transition-all duration-300 group-hover:-translate-y-1 group-hover:rotate-0 group-hover:z-50 group-hover:shadow-[0_16px_40px_rgba(42,39,36,0.22)]">
              <MediaCard media={m} thumbnailOnly />
            </div>
            {/* feature tile shows its like count for a touch of social proof */}
            {i === 0 && (m._count?.likes ?? 0) > 0 && (
              <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-sm text-white text-[11px] font-semibold">
                <Heart className="w-3 h-3 fill-red-500 text-red-500" />
                {m._count?.likes}
              </span>
            )}
          </Link>
        </motion.div>
      ))}
    </Stage>
  );
}
