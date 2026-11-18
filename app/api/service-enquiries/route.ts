import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { hasServerSupabaseConfig } from '@/lib/public-config';
import { notify, supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!hasServerSupabaseConfig()) return NextResponse.json({ error: 'Enquiries are not connected yet. Please try again later.' }, { status: 503 });
  let originAllowed = false;
  try {
    const origin = request.headers.get('origin');
    const allowed = process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin : new URL(request.url).origin;
    originAllowed = !origin || origin === allowed;
  } catch { /* invalid configured URL */ }
  if (!originAllowed) return NextResponse.json({ error: 'This enquiry could not be verified.' }, { status: 403 });
  try {
    const body = await request.json();
    if (String(body.website_url || '').trim()) return NextResponse.json({ ok: true, emailSent: false });
    const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
    const name = clean(body.name, 120).replace(/\s+/g, ' ');
    const email = clean(body.email, 254).toLowerCase();
    const organisation = clean(body.organisation, 160);
    const phone = clean(body.phone, 40);
    const category = clean(body.category || body.service_required, 100);
    const subject = clean(body.subject || category, 180);
    const description = clean(body.project_description, 5000);
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !category || subject.length < 3 || description.length < 10) return NextResponse.json({ error: 'Please provide your name, valid email, enquiry subject and details (at least 10 characters).' }, { status: 400 });
    const admin = supabaseAdmin();
    const digest = createHash('sha256').update(`${process.env.VISITOR_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY}:${email}`).digest('hex');
    const { data: allowed, error: limitError } = await admin.rpc('check_career_interest_rate_limit', { p_email_hash: digest });
    if (limitError) throw limitError;
    if (!allowed) return NextResponse.json({ error: 'You have reached the enquiry limit. Please try again in 24 hours.' }, { status: 429 });
    const id = randomUUID();
    const { data, error } = await admin.from('service_enquiries').insert({
      id, name, organisation: organisation || null, email, phone: phone || null,
      category, subject, service_required: category, project_description: description,
      budget_range: clean(body.budget_range, 100) || null, expected_timeline: clean(body.expected_timeline, 120) || null,
    }).select('id,enquiry_id').single();
    if (error) throw error;
    const emailSent = await notify(`New RILORA enquiry ${data.enquiry_id}`, `<p>A new enquiry is saved in the Admin Dashboard.</p><p>Reference: ${escapeHtml(data.enquiry_id)}<br/>Category: ${escapeHtml(category)}<br/>Subject: ${escapeHtml(subject)}<br/>From: ${escapeHtml(name)} (${escapeHtml(email)})</p>`);
    return NextResponse.json({ ok: true, id: data.enquiry_id, emailSent });
  } catch (error) {
    console.error('Enquiry submission failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to save your enquiry. Please try again later.' }, { status: 503 });
  }
}
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[char]!); }
