'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/axios';
import { User } from '@/types';
import { Mail, Calendar, Image as ImageIcon, Lock, ArrowLeft } from 'lucide-react';

type PublicProfile = Partial<User> & { isPrivate?: boolean };

export default function PublicProfilePage() {
  const params = useParams();
  const id = params?.id as string;
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get(`/auth/users/${id}`)
      .then((res) => setProfile(res.data.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="h-6 w-24 skeleton" />
        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full skeleton" />
            <div className="space-y-2">
              <div className="h-5 w-40 skeleton" />
              <div className="h-4 w-24 skeleton" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <p className="text-slate-500 font-medium">User not found</p>
        <Link href="/gallery" className="text-primary-400 hover:underline text-sm mt-2 inline-block">
          Back to gallery
        </Link>
      </div>
    );
  }

  const initial = profile.fullName?.[0] || profile.username?.[0] || '?';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/gallery" className="flex items-center gap-2 text-slate-400 hover:text-[#2a2724] text-sm">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div className="card p-6">
        <div className="flex items-center gap-4">
          {profile.avatar ? (
            <img src={profile.avatar} alt="" className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-2xl font-bold text-white">
              {initial}
            </div>
          )}
          <div>
            <p className="text-xl font-bold">{profile.fullName}</p>
            <p className="text-sm text-slate-400">@{profile.username}</p>
            {!profile.isPrivate && profile.role && (
              <span className="badge bg-primary-900/50 text-primary-400 text-xs mt-1">{profile.role}</span>
            )}
          </div>
        </div>

        {profile.isPrivate ? (
          <div className="mt-6 flex flex-col items-center text-center gap-2 py-8 border-t border-[#e7e3dd]">
            <div className="w-12 h-12 rounded-full bg-[#f0ede8] flex items-center justify-center">
              <Lock className="w-5 h-5 text-slate-500" />
            </div>
            <p className="font-medium">This profile is private</p>
            <p className="text-sm text-slate-500">{profile.fullName} has chosen not to make their profile public.</p>
          </div>
        ) : (
          <>
            {profile.bio && <p className="text-sm text-[#6b6560] mt-4">{profile.bio}</p>}

            <div className="mt-6 space-y-3 text-sm border-t border-[#e7e3dd] pt-4">
              {profile.email && (
                <div className="flex items-center gap-2 text-slate-400">
                  <Mail className="w-4 h-4" />
                  <span className="text-[#4a4540]">{profile.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-slate-400">
                <ImageIcon className="w-4 h-4" />
                <span className="text-[#4a4540]">{profile._count?.mediaUploads ?? 0} uploads</span>
              </div>
              {profile.createdAt && (
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="w-4 h-4" />
                  <span className="text-[#4a4540]">Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
