'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Eye, EyeOff, Camera, Mail, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-950 via-slate-900 to-primary-950">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Camera className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">Welcome Back</h1>
          <p className="text-slate-400 mt-2">Sign in to your EventMedia account</p>
        </div>

        <div className="card p-6">
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
                <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
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
                  placeholder="••••••••"
                  autoComplete="new-password"
                  readOnly={!isEditable}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
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
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-slate-400">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-primary-400 hover:text-primary-300 font-medium">
              Sign up
            </Link>
          </div>

          <div className="mt-6 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <p className="text-xs text-slate-400 mb-2 font-medium">Demo Accounts:</p>
            <div className="space-y-1 text-xs text-slate-500">
              <p>Admin: admin@eventmedia.com / Password123!</p>
              <p>Photographer: photographer@eventmedia.com / Password123!</p>
              <p>Member: member@eventmedia.com / Password123!</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
