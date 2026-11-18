'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';
import { hasPublicSupabaseConfig } from '@/lib/public-config';

const client = hasPublicSupabaseConfig() && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  : null;

export default function AdminLoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [resetMode, setResetMode] = useState(false);

  const establishAdminSession = useCallback(async (accessToken: string) => {
    const response = await fetch('/api/admin/session', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'This account is not authorized as a RILORA administrator.');
    router.replace('/admin');
  }, [router]);

  useEffect(() => {
    let active = true;
    if (client) void client.auth.getSession().then(async ({ data }) => {
      if (!active || !data.session) return;
      try { await establishAdminSession(data.session.access_token); }
      catch (error) { if (active) setMessage(error instanceof Error ? error.message : 'Administrator access could not be verified.'); }
    });
    return () => { active = false; };
  }, [establishAdminSession]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) { setMessage('Supabase is not configured. Add the project URL and publishable key to .env.local, then restart the app.'); return; }
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim();
    setBusy(true); setMessage('');
    try {
      if (resetMode) {
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/account` });
        if (error) throw error;
        setMessage('If an account exists for that address, Supabase has sent a password reset email.');
      } else {
        const password = String(form.get('password') || '');
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.session) throw new Error('Supabase did not return an active session.');
        await establishAdminSession(data.session.access_token);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to sign in. Check the credentials and Supabase configuration.');
      if (!resetMode) await client.auth.signOut();
    } finally { setBusy(false); }
  }

  return <main className="section admin-login-page"><div className="container" style={{ maxWidth: 560 }}>
    <section className="card admin-login-card">
      <Image src="/brand/rilora-messaging.jpeg" alt="RILORA" width={64} height={64} style={{ borderRadius: 12 }} />
      <div className="eyebrow" style={{ marginTop: 18 }}>RILORA · Innovate. Build. Empower.</div>
      <h1>{resetMode ? 'Reset administrator password' : 'Administrator sign in'}</h1>
      <p className="status">Sign in with an authorized RILORA administrator account. Administrator access is verified by Supabase on the server.</p>
      <form onSubmit={submit}>
        <div className="field"><label htmlFor="admin-email">Email</label><input id="admin-email" name="email" type="email" autoComplete="username" required maxLength={254} /></div>
        {!resetMode && <div className="field"><label htmlFor="admin-password">Password</label><input id="admin-password" name="password" type="password" autoComplete="current-password" required minLength={8} /></div>}
        <button className="btn" disabled={busy}>{busy ? 'Please wait…' : resetMode ? 'Send reset link' : 'Sign in securely'}</button>
        <button className="btn secondary" type="button" style={{ marginLeft: 10 }} disabled={busy} onClick={() => { setResetMode(!resetMode); setMessage(''); }}>{resetMode ? 'Back to sign in' : 'Forgot password?'}</button>
      </form>
      {message && <p className="notice" role="status" aria-live="polite">{message}</p>}
    </section>
  </div></main>;
}
