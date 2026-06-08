'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/axios';
import {
  Lock, AlertTriangle, FolderOpen, Calendar, User,
  Images, ArrowRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

interface EventData {
  id: string;
  name: string;
  description?: string;
  category: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  startDate: string;
  endDate?: string;
  location?: string;
  creator: { username: string; fullName: string };
  albums: {
    id: string;
    name: string;
    description?: string;
    coverImage?: string;
    visibility: 'PUBLIC' | 'PRIVATE';
    _count: { media: number };
  }[];
  _count: { albums: number };
}

type PageState = 'loading' | 'success' | 'not-found' | 'error';

export default function EventSharePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [event, setEvent] = useState<EventData | null>(null);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const res = await api.get(`/events/by-token/${token}`);
        if (res.data.data.redirectId) {
          router.replace(`/events/${res.data.data.redirectId}`);
          return;
        }
        setEvent(res.data.data);
        setPageState('success');
      } catch (err: any) {
        if (err.response?.status === 404) {
          setPageState('not-found');
        } else {
          setPageState('error');
        }
      }
    };
    load();
  }, [token, router]);

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 text-sm">Loading event…</p>
        </div>
      </div>
    );
  }

  if (pageState === 'not-found') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="card p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-5 ring-1 ring-red-800/40">
            <Lock className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold mb-2 text-[#2a2724]">Link Not Found</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            This share link is invalid or has been revoked by the event organiser.
          </p>
        </div>
      </div>
    );
  }

  if (pageState === 'error' || !event) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="card p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-xl font-bold mb-2 text-[#2a2724]">Something went wrong</h1>
          <p className="text-slate-400 text-sm">Unable to load the event. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl overflow-hidden border border-[#e7e3dd]/80 bg-gradient-to-br from-primary-950/70 via-slate-900 to-primary-900/50"
        >
          <div className="px-7 pt-7 pb-5">
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border bg-red-900/40 text-red-400 border-red-800/60">
                <Lock className="w-3 h-3" /> Private
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border bg-[#f8f7f5] text-[#6b6560] border-[#e7e3dd]">
                {event.category}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#2a2724]">
              {event.name}
            </h1>
            {event.description && (
              <p className="mt-2 text-slate-400 text-sm leading-relaxed max-w-xl">
                {event.description}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 px-7 py-4 border-t border-[#e7e3dd]/60 bg-slate-950/40">
            <span className="flex items-center gap-1.5 text-sm text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-primary-400" />
              {format(new Date(event.startDate), 'MMM dd, yyyy')}
              {event.endDate && <> – {format(new Date(event.endDate), 'MMM dd, yyyy')}</>}
            </span>
            <span className="flex items-center gap-1.5 text-sm text-slate-400">
              <User className="w-3.5 h-3.5 text-primary-400" />
              {event.creator.fullName}
            </span>
            <span className="flex items-center gap-1.5 text-sm text-slate-400">
              <Images className="w-3.5 h-3.5 text-primary-400" />
              {event._count.albums} {event._count.albums === 1 ? 'Album' : 'Albums'}
            </span>
          </div>
        </motion.div>

        {/* Guest notice */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
          <Lock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200/80 leading-relaxed">
            You&apos;re viewing this private event via a guest share link. Some albums may still
            require login to access.
          </p>
        </div>

        {/* Albums */}
        <div>
          <h2 className="text-base font-bold text-[#4a4540] mb-4">
            Albums
            <span className="ml-2 text-sm font-normal text-slate-500">
              ({event.albums.length})
            </span>
          </h2>

          {event.albums.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-[#e7e3dd] bg-[#f0ede8]">
              <FolderOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No albums in this event yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {event.albums.map((album, i) => (
                <motion.div
                  key={album.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link href={`/events/albums/${album.id}`}>
                    <div className="rounded-2xl overflow-hidden border border-[#e7e3dd]/80 bg-slate-900 hover:border-primary-700/70 hover:shadow-lg cursor-pointer transition-all duration-200 hover:-translate-y-0.5">
                      <div className="h-36 bg-gradient-to-br from-slate-800 to-slate-900 relative overflow-hidden">
                        {album.coverImage ? (
                          <img
                            src={album.coverImage}
                            alt={album.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FolderOpen className="w-9 h-9 text-slate-700" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-transparent" />
                        <div className="absolute top-2.5 left-2.5">
                          {album.visibility === 'PRIVATE' ? (
                            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-900/85 text-red-400 border border-red-800/50">
                              <Lock className="w-2.5 h-2.5" /> Private
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-900/85 text-green-400 border border-green-800/50">
                              Album
                            </span>
                          )}
                        </div>
                        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 text-xs text-[#6b6560] bg-slate-900/75 px-2 py-0.5 rounded-md">
                          <Images className="w-3 h-3" />
                          {album._count.media}
                        </div>
                      </div>
                      <div className="px-4 py-3 flex items-center justify-between">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-[#2a2724] truncate">{album.name}</h3>
                          {album.description && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{album.description}</p>
                          )}
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-500 flex-shrink-0 ml-2" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
