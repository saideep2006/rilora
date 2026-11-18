export function looksConfigured(value: string | undefined) {
  return Boolean(value?.trim() && !/(your_|placeholder|example\.example)/i.test(value));
}

export function hasServerSupabaseConfig() {
  return hasPublicSupabaseConfig() && looksConfigured(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasPublicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!looksConfigured(url) || !looksConfigured(key)) return false;
  try {
    const parsed = new URL(url!);
    return parsed.protocol === 'https:' || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}
