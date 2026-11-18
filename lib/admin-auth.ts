import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';

export const ADMIN_SESSION_COOKIE = 'rilora-admin-session';

export async function getPageAdmin() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const client = supabase(token);
    const { data: authData, error: authError } = await client.auth.getUser(token);
    if (authError || !authData.user) return null;
    const { data: role, error: roleError } = await client.from('user_roles').select('role').eq('user_id', authData.user.id).maybeSingle();
    if (roleError || role?.role !== 'admin') return null;
    return { user: authData.user };
  } catch {
    return null;
  }
}
