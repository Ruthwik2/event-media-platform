'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import api from '@/lib/axios';
import { QRCodeCanvas } from 'qrcode.react';
import {
  X, Download, Copy, Check, Globe, Lock, AlertTriangle,
  Link2, RefreshCw, Trash2, ShieldCheck, Users, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface EventShare {
  id: string;
  name: string;
  visibility: 'PUBLIC' | 'PRIVATE';
}

interface QRData {
  url: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  hasShareToken: boolean;
  guestAccessEnabled: boolean;
}

interface Props {
  event: EventShare;
  canManage: boolean;
  onClose: () => void;
}

export default function ShareEventModal({ event, canManage, onClose }: Props) {
  const [qrData, setQrData] = useState<QRData | null>(null);
  const [loading, setLoading]       = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [copied, setCopied]         = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const loadQR = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/events/${event.id}/qr`);
      setQrData(res.data.data);
    } catch {
      toast.error('Failed to load share info');
    } finally {
      setLoading(false);
    }
  }, [event.id]);

  useEffect(() => { loadQR(); }, [loadQR]);

  const handleCopy = async () => {
    if (!qrData) return;
    await navigator.clipboard.writeText(qrData.url);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${event.name.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
  };

  const handleGenerateToken = async () => {
    if (!confirm(
      'Enable guest access?\n\nShare this link or QR to give access to this private event.\n\nYou can revoke this at any time.'
    )) return;
    setTokenLoading(true);
    try {
      await api.post(`/events/${event.id}/share-token`);
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
      'Revoke guest access?\n\nAll existing share links and QR codes will immediately stop working. Only authorized members will be able to view this event.'
    )) return;
    setTokenLoading(true);
    try {
      await api.delete(`/events/${event.id}/share-token`);
      toast.success('Guest access revoked');
      await loadQR();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to revoke token');
    } finally {
      setTokenLoading(false);
    }
  };

  const isPrivate = event.visibility === 'PRIVATE';

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
              <h3 className="font-semibold text-sm text-[#2a2724]">Share Event</h3>
              <p className="text-xs text-[#6b6560] mt-0.5 truncate max-w-[200px]">{event.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#f0ede8] transition-colors">
            <X className="w-4 h-4 text-[#6b6560]" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Visibility banner */}
          {isPrivate ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="text-sm font-medium text-amber-800">Private Event</span>
              </div>
              {qrData?.guestAccessEnabled ? (
                <p className="text-xs text-amber-700 leading-relaxed">
                  <strong className="text-amber-800">Guest access is ON.</strong> Share the QR or
                  link below to give others access to this event. Revoke to re-lock it.
                </p>
              ) : (
                <p className="text-xs text-amber-700 leading-relaxed">
                  Only authorized members (admins, approved photographers) can view this event.
                  Enable guest access below to share a direct link.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-2">
              <Globe className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-800">Public Event</p>
                <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
                  Share this QR or link to give others access to this event.
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
              <div className="relative" ref={canvasRef}>
                <div className="p-3 rounded-2xl bg-white border border-[#e7e3dd]">
                  <QRCodeCanvas
                    value={qrData.url}
                    size={176}
                    level="M"
                    includeMargin={true}
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                </div>
              </div>
            ) : null}
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

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              disabled={!qrData || loading}
              className="flex-1 btn-secondary text-xs flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Download QR
            </button>
          </div>

          {/* Private event: guest access controls (admin / creator only) */}
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
                        Share the QR or link to give others access to this private event.
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
                      Enable guest access to generate a direct share link for this private event.
                      You can revoke it at any time.
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

          {/* Info for private event non-managers */}
          {isPrivate && !canManage && qrData && !qrData.guestAccessEnabled && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-[#f8f7f5] border border-[#e7e3dd]">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#6b6560] leading-relaxed">
                This QR links to a private event. Only authorized members can view it after scanning.
                Contact an admin to enable guest access.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
