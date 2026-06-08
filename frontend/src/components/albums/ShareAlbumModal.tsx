'use client';
import { useState, useCallback, useEffect } from 'react';
import api from '@/lib/axios';
import {
  X, Download, Copy, Check, Globe, Lock, AlertTriangle,
  Link2, RefreshCw, Trash2, ShieldCheck, Users,
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

  useEffect(() => { loadQR(); }, [loadQR]);

  const handleCopy = async () => {
    if (!qrData) return;
    await navigator.clipboard.writeText(qrData.url);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    if (!qrData) return;
    const a = document.createElement('a');
    a.href = qrData.qrCode;
    a.download = `qr-${album.name.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
  };

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white border border-[#e7e3dd] rounded-2xl shadow-[0_8px_32px_rgba(42,39,36,0.12)] w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#e7e3dd]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#f0ede8]">
              {isPrivate
                ? <Lock className="w-4 h-4 text-amber-600" />
                : <Globe className="w-4 h-4 text-emerald-600" />
              }
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#2a2724]">Share Album</h3>
              <p className="text-xs text-[#6b6560] mt-0.5 truncate max-w-[200px]">{album.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#f0ede8] transition-colors">
            <X className="w-4 h-4 text-[#6b6560]" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Visibility badge + explanation */}
          {isPrivate ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="text-sm font-medium text-amber-800">Private Album</span>
              </div>
              {qrData?.guestAccessEnabled ? (
                <p className="text-xs text-amber-700 leading-relaxed">
                  <strong className="text-amber-800">Guest access is ON.</strong> Anyone who scans
                  this QR or opens the link can view the album — no login required. Revoke to
                  re-lock it.
                </p>
              ) : (
                <p className="text-xs text-amber-700 leading-relaxed">
                  Only authorized members (admins, collaborators) can view this album. Viewers
                  who scan the QR will see an access-denied screen. Enable guest access below to
                  let anyone with the link view without logging in.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-2">
              <Globe className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-800">Public Album</p>
                <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
                  Anyone who scans this QR or opens the link can view the album — no login needed.
                </p>
              </div>
            </div>
          )}

          {/* QR Code */}
          <div className="flex flex-col items-center">
            {loading ? (
              <div className="w-48 h-48 bg-[#f0ede8] rounded-xl animate-pulse flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-[#6b6560] animate-spin" />
              </div>
            ) : qrData ? (
              <div className="relative">
                <div className="p-3 rounded-2xl bg-white border border-[#e7e3dd]">
                  <img
                    src={qrData.qrCode}
                    alt="Album QR Code"
                    className="w-44 h-44 block"
                  />
                </div>
              </div>
            ) : null}

            {/* Access-type indicator under QR */}
            {qrData && (qrData.guestAccessEnabled || !isPrivate) && (
              <div className="flex items-center gap-1.5 mt-3">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-xs text-emerald-700">
                  {isPrivate ? 'Guest link — anyone can scan' : 'Public — anyone can scan'}
                </span>
              </div>
            )}
          </div>

          {/* Share link + copy */}
          {qrData && (
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-[#f8f7f5] border border-[#e7e3dd] rounded-lg min-w-0">
                <Link2 className="w-3.5 h-3.5 text-[#6b6560] flex-shrink-0" />
                <span className="text-xs text-[#2a2724] truncate font-mono">{qrData.url}</span>
              </div>
              <button
                onClick={handleCopy}
                className="p-2 rounded-lg bg-[#f0ede8] hover:bg-[#e7e3dd] transition-colors flex-shrink-0"
                title="Copy link"
              >
                {copied
                  ? <Check className="w-4 h-4 text-emerald-600" />
                  : <Copy className="w-4 h-4 text-[#2a2724]" />
                }
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              disabled={!qrData}
              className="flex-1 btn-secondary text-xs flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Download QR
            </button>
          </div>

          {/* Private album: guest access controls (admin / creator only) */}
          {isPrivate && canManage && qrData && (
            <div className="border-t border-[#e7e3dd] pt-4 space-y-3">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#6b6560]" />
                <span className="text-xs font-medium text-[#2a2724]">Guest Access</span>
              </div>

              {qrData.guestAccessEnabled ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-emerald-800">Guest access is active</p>
                      <p className="text-xs text-emerald-700 mt-0.5">
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
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-[#f8f7f5] border border-[#e7e3dd]">
                    <Info className="w-4 h-4 text-[#6b6560] flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-[#6b6560] leading-relaxed">
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

          {/* Info for private album non-managers */}
          {isPrivate && !canManage && qrData && !qrData.guestAccessEnabled && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-[#f8f7f5] border border-[#e7e3dd]">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#6b6560] leading-relaxed">
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
