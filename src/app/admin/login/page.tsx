'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Wheat, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;

      router.replace('/admin');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#faf8f5]">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl bg-white p-7 sm:p-8 shadow-xl border border-stone-200/80 space-y-6"
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/25">
            <Wheat className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-extrabold text-stone-900 tracking-tight">
            Shopkeeper Login
          </h1>
          <p className="text-xs text-stone-600">
            Enter your administrator credentials to manage orders & live rates
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form with Password Manager Autofill & Save Attributes */}
        <form
          name="admin-login-form"
          method="post"
          autoComplete="on"
          onSubmit={handleAuth}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="admin-email"
              className="block text-xs font-bold text-stone-700 mb-1.5 cursor-pointer"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="admin-email"
                name="username"
                type="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 text-sm focus:border-amber-500 focus:outline-none transition bg-stone-50/50"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-xs font-bold text-stone-700 mb-1.5 cursor-pointer"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-stone-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="admin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 text-sm focus:border-amber-500 focus:outline-none transition bg-stone-50/50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-amber-600 hover:bg-amber-700 active:scale-[0.98] transition shadow-md shadow-amber-600/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing In...
              </>
            ) : (
              'Secure Sign In'
            )}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-stone-100">
          <p className="text-[11px] text-stone-600 font-medium">
            Authorized Chakki personnel only
          </p>
        </div>
      </motion.div>
    </div>
  );
}
