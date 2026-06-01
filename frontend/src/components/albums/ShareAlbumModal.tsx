'use client';
import { useState, useCallback } from 'react';
import api from '@/lib/axios';
import {
  X, Download, Copy, Check, Globe, Lock, AlertTriangle,
  Link2, RefreshCw, Trash2, ShieldCheck, ShieldOff, Users,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Album {
  id: string;
  name: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  event?: { id: string; name: string };
}

interface QRData {
  qrCode: string;       // data URL
  url: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  hasShareToken: boolean;
  guestAccessEnabled: boolean;
}

interface Props {
  album: Album;
  canManage: boolean; // true for creator / ADMIN
  onClose: () => void;
}

export default function ShareAlbumModal({ album, canManage, onClose }: Props) {
  const [qrData, setQrData] = useState<QRData | null>(null);
  const [loading, setLoading] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Load QR on mount ──────────────────────────────────────────────────────
  const loadQR = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/albums/${album.id}/qr`);
      setQrData(res.data.data);
    } catch {
      toast.error('Failed to load QR code');
    } finally {
      setLoading(false);
    }
  }, [album.id]);

  // Load on first open
  useState(() => { loadQR(); });

  // ── Copy link ─────────────────────────────────────────────────────────────
  const handleCopy = async () => {
    if (!qrData) return;
    await navigator.clipboard.writeText(qrData.url);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2500);
  };

  // ── Download QR ───────────────────────────────────────────────────────────
  const handleDownload = () => {
    if (!qrData) return;
    const a = document.createElement('a');
    a.href = qrData.qrCode;
    a.download = `qr-${album.name.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
  };

  // ── Generate share token ──────────────────────────────────────────────────
  const handleGenerateToken = async () => {
    if (!confirm(
      'Enable guest access?\n\nAnyone who scans the QR or uses this link can view the album — no login required.\n\nYou can revoke this at any time.'
    )) return;
    setTokenLoading(true);
    try {
      await api.post(`/albums/${album.id}/share-token`);
      toast.success('Guest access enabled — new QR generated');
      await loadQR();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to generate token');
    } finally {
      setTokenLoading(false);
    }
  };

  // ── Revoke share token ────────────────────────────────────────────────────
  const handleRevokeToken = async () => {
    if (!confirm(
      'Revoke guest access?\n\nAll existing share links and QR codes will immediately stop working. Only authorized members will be able to view this album.'
    )) return;
    setTokenLoading(true);
    try {
      await api.delete(`/albums/${album.id}/share-token`);
      toast.success('Guest access revoked');
      await loadQR();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to revoke token');
    } finally {
      setTokenLoading(false);
    }
  };

  const isPrivate = album.visibility === 'PRIVATE';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-700/50">
              {isPrivate
                ? <Lock className="w-4 h-4 text-amber-400" />
                : <Globe className="w-4 h-4 text-emerald-400" />
              }
            </div>
            <div>
              <h3 className="font-semibold text-sm">Share Album</h3>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">{album.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* ── Visibility badge + explanation ────────────────────────────── */}
          {isPrivate ? (
            <div className="rounded-xl border border-amber-700/40 bg-amber-900/20 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="text-sm font-medium text-amber-300">Private Album</span>
              </div>
              {qrData?.guestAccessEnabled ? (
                <p className="text-xs text-amber-200/70 leading-relaxed">
                  <strong className="text-amber-300">Guest access is ON.</strong> Anyone who scans
                  this QR or opens the link can view the album — no login required. Revoke to
                  re-lock it.
                </p>
              ) : (
                <p className="text-xs text-amber-200/70 leading-relaxed">
                  Only authorized members (admins, collaborators) can view this album. Viewers
                  who scan the QR will see an access-denied screen. Enable guest access below to
                  let anyone with the link view without logging in.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/20 p-4 flex items-start gap-2">
              <Globe className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-300">Public Album</p>
                <p className="text-xs text-emerald-200/70 mt-0.5 leading-relaxed">
                  Anyone who scans this QR or opens the link can view the album — no login needed.
                </p>
              </div>
            </div>
          )}

          {/* ── QR Code ───────────────────────────────────────────────────── */}
          <div className="flex flex-col items-center">
            {loading ? (
              <div className="w-48 h-48 bg-slate-800 rounded-xl animate-pulse flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-slate-600 animate-spin" />
              </div>
            ) : qrData ? (
              <div className="relative">
                <div className={`p-3 rounded-2xl ${qrData.guestAccessEnabled || !isPrivate ? 'bg-white' : 'bg-white/80 grayscale'}`}>
                  <img
                    src={qrData.qrCode}
                    alt="Album QR Code"
                    className="w-44 h-44 block"
                  />
                </div>
                {isPrivate && !qrData.guestAccessEnabled && (
                  <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-black/50">
                    <div className="text-center px-3">
                      <Lock className="w-6 h-6 text-amber-400 mx-auto mb-1" />
                      <p className="text-xs text-amber-300 font-medium">Login required to scan</p>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Access-type indicator under QR */}
            {qrData && (
              <div className="flex items-center gap-1.5 mt-3">
                {qrData.guestAccessEnabled || !isPrivate ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs text-emerald-400">
                      {isPrivate ? 'Guest link — anyone can scan' : 'Public — anyone can scan'}
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldOff className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs text-slate-500">Login required to view after scan</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Share link + copy ─────────────────────────────────────────── */}
          {qrData && (
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg min-w-0">
                <Link2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                <span className="text-xs text-slate-400 truncate font-mono">{qrData.url}</span>
              </div>
              <button
                onClick={handleCopy}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors flex-shrink-0"
                title="Copy link"
              >
                {copied
                  ? <Check className="w-4 h-4 text-emerald-400" />
                  : <Copy className="w-4 h-4 text-slate-300" />
                }
              </button>
            </div>
          )}

          {/* ── Action buttons ────────────────────────────────────────────── */}
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              disabled={!qrData}
              className="flex-1 btn-secondary text-xs flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Download QR
            </button>
          </div>

          {/* ── Private album: guest access controls (admin / creator only) ── */}
          {isPrivate && canManage && qrData && (
            <div className="border-t border-slate-700/60 pt-4 space-y-3">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-medium text-slate-300">Guest Access</span>
              </div>

              {qrData.guestAccessEnabled ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-900/20 border border-emerald-700/30">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-emerald-300">Guest access is active</p>
                      <p className="text-xs text-emerald-200/60 mt-0.5">
                        Anyone with the QR or link can view this private album without an account.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleGenerateToken}
                      disabled={tokenLoading}
                      className="flex-1 btn-secondary text-xs flex items-center justify-center gap-1.5"
                      title="Rotate token — invalidates old links"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${tokenLoading ? 'animate-spin' : ''}`} />
                      Rotate Link
                    </button>
                    <button
                      onClick={handleRevokeToken}
                      disabled={tokenLoading}
                      className="flex-1 btn-danger text-xs flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Revoke Access
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-800/60 border border-slate-700/40">
                    <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Enable guest access to let event attendees view this album by scanning the QR
                      — no account required. You can revoke it at any time.
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateToken}
                    disabled={tokenLoading}
                    className="w-full btn-secondary text-xs flex items-center justify-center gap-1.5"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    {tokenLoading ? 'Generating…' : 'Enable Guest Access'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Info for private album non-managers ───────────────────────── */}
          {isPrivate && !canManage && qrData && !qrData.guestAccessEnabled && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-800/60 border border-slate-700/40">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-400 leading-relaxed">
                This QR links to a private album. Only authorized members can view it after scanning.
                Contact an admin to enable guest access.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
