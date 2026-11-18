import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { hasServerSupabaseConfig } from '@/lib/public-config';
import { requireAdmin, supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
const limit = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  if (!hasServerSupabaseConfig()) return NextResponse.json({ error: 'Server storage is not configured.' }, { status: 503 });
  let path: string | null = null;
  try {
    const form = await request.formData();
    const file = form.get('image');
    if (!(file instanceof File) || !file.size || file.size > limit) return NextResponse.json({ error: 'Choose an image up to 5 MB.' }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = file.type;
    const jpeg = mime === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = mime === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const webp = mime === 'image/webp' && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
    if (!jpeg && !png && !webp) return NextResponse.json({ error: 'Use a valid JPEG, PNG or WebP image.' }, { status: 400 });
    const ext = jpeg ? 'jpg' : png ? 'png' : 'webp';
    path = `jobs/${randomUUID()}.${ext}`;
    const admin = supabaseAdmin();
    const { error } = await admin.storage.from('job-images').upload(path, bytes, { contentType: mime, upsert: false });
    if (error) throw error;
    const { data } = admin.storage.from('job-images').getPublicUrl(path);
    return NextResponse.json({ ok: true, path, publicUrl: data.publicUrl });
  } catch {
    if (path) { try { await supabaseAdmin().storage.from('job-images').remove([path]); } catch { /* best effort cleanup */ } }
    return NextResponse.json({ error: 'Could not upload this image.' }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  try {
    const { path } = await request.json();
    if (typeof path !== 'string' || !/^jobs\/[a-f0-9-]+\.(jpg|png|webp)$/i.test(path)) return NextResponse.json({ error: 'Invalid job image.' }, { status: 400 });
    const { error } = await supabaseAdmin().storage.from('job-images').remove([path]);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Could not remove this job image.' }, { status: 503 }); }
}
