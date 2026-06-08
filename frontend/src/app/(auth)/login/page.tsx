'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Eye, EyeOff, Camera, Mail, Lock, ArrowRight, Images, Heart, ScanFace } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// What the platform is — surfaced on the hero panel so a first-time visitor
// understands the app before signing in.
const HIGHLIGHTS = [
  { icon: Images, text: 'Browse event galleries' },
  { icon: ScanFace, text: 'Find your photos with AI face recognition' },
  { icon: Heart, text: 'Relive every moment together' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isEditable, setIsEditable] = useState(false);
  const { login, isLoading } = useAuthStore();
  const router = useRouter();

  const validateEmail = (val: string) => {
    if (!val.trim()) return 'Email is required';
    if (!EMAIL_RE.test(val.trim())) return 'Please enter a valid email address';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmail(email);
    if (err) { setEmailError(err); return; }
    try {
      const result = await login(email.trim(), password);
      toast.success('Welcome back!');
      // Unapproved club members go to the pending approval page
      if (result?.user?.role === 'CLUB_MEMBER' && !result?.user?.isApproved) {
        window.location.href = '/pending-approval';
      } else {
        // Use hard navigation so the browser sends the newly-set cookie with
        // the request — router.push() is client-side and the middleware can
        // read the cookie before it is flushed, causing a redirect loop.
        window.location.href = '/';
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-stretch">
      {/* ── Left hero — tells the visitor what CIG Media is ─────────────── */}
      <aside className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary-700 text-white">
        <div
          className="absolute inset-0 opacity-25 pointer-events-none"
          style={{
            background:
              'radial-gradient(40% 40% at 20% 20%, rgba(255,255,255,0.18) 0%, transparent 60%),' +
              'radial-gradient(45% 45% at 85% 80%, rgba(255,255,255,0.10) 0%, transparent 60%)',
          }}
        />
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">CIG Media</span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-md"
          >
            <h1 className="text-4xl xl:text-5xl font-extrabold leading-tight tracking-tight">
              Capture every <span className="text-primary-200">moment</span>, share every story.
            </h1>
            <p className="mt-5 text-base xl:text-lg text-white/80 leading-relaxed">
              Your club&apos;s media hub. Browse event galleries and relive every
              moment together.
            </p>

            <ul className="mt-8 space-y-3">
              {HIGHLIGHTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-white/90">
                  <span className="w-8 h-8 rounded-xl bg-white/12 ring-1 ring-white/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="text-sm xl:text-base">{text}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <div className="flex items-center gap-3 text-white/70 text-sm">
            <div className="flex -space-x-2">
              {['V', 'C', 'P'].map((c) => (
                <span
                  key={c}
                  className="w-7 h-7 rounded-full bg-white/15 ring-2 ring-primary-700 flex items-center justify-center text-[11px] font-semibold"
                >
                  {c}
                </span>
              ))}
            </div>
            <span>Join hundreds of club members</span>
          </div>
        </div>
      </aside>

      {/* ── Right — sign-in form ───────────────────────────────────────── */}
      <main className="flex w-full lg:w-1/2 items-center justify-center px-4 py-10 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Compact brand for small screens where the hero is hidden */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-2xl bg-primary-600 flex items-center justify-center">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight gradient-text">CIG Media</span>
          </div>

          <div className="mb-7">
            <h2 className="text-3xl font-bold">Sign in</h2>
            <p className="text-slate-400 mt-2">Welcome back. Enter your credentials to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(validateEmail(e.target.value));
                  }}
                  onBlur={() => setEmailError(validateEmail(email))}
                  onFocus={() => setIsEditable(true)}
                  className={`input pl-10 ${emailError ? 'border-red-500 focus:border-red-500' : ''}`}
                  placeholder="you@example.com"
                  autoComplete="off"
                  readOnly={!isEditable}
                />
              </div>
              {emailError && (
                <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-red-500 flex-shrink-0" />
                  {emailError}
                </p>
              )}
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setIsEditable(true)}
                  className="input pl-10 pr-10"
                  placeholder="Your password"
                  autoComplete="new-password"
                  readOnly={!isEditable}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full justify-center py-2.5"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-slate-400">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-primary-600 hover:text-primary-700 font-semibold">
              Create one
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
