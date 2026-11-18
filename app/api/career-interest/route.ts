import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { CAREER_INTEREST_ROLES } from '@/lib/career-roles';
import { hasServerSupabaseConfig } from '@/lib/public-config';
import { notify, supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  if (!hasServerSupabaseConfig()) {
    return NextResponse.json({ error: 'Career submissions are not connected yet. Please try again later.' }, { status: 503 });
  }
  let siteOrigin: string | null = null;
  try { siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin : null; } catch { /* Invalid optional URL is ignored. */ }
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get('origin');
  if (origin && origin !== requestOrigin && origin !== siteOrigin) {
    return NextResponse.json({ error: 'This submission could not be verified.' }, { status: 403 });
  }
  const length = Number(request.headers.get('content-length') || '0');
  if (length > MAX_RESUME_BYTES + 32_000) {
    return NextResponse.json({ error: 'Resume must be 5 MB or smaller.' }, { status: 413 });
  }

  let uploadedPath: string | null = null;
  try {
    const form = await request.formData();
    if (String(form.get('website_url') || '').trim()) {
      return NextResponse.json({ ok: true, emailSent: false });
    }
    const fullName = String(form.get('full_name') || '').trim().replace(/\s+/g, ' ');
    const email = String(form.get('email') || '').trim().toLowerCase();
    const role = String(form.get('role_title') || '').trim();
    const consent = form.get('consent') === 'on';
    const resume = form.get('resume');
    if (fullName.length < 2 || fullName.length > 120) {
      return NextResponse.json({ error: 'Enter your name (2 to 120 characters).' }, { status: 400 });
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }
    if (!CAREER_INTEREST_ROLES.some((entry) => entry === role)) {
      return NextResponse.json({ error: 'Choose a role interest from the list.' }, { status: 400 });
    }
    if (!consent) return NextResponse.json({ error: 'Please consent to RILORA reviewing your resume and contacting you.' }, { status: 400 });
    if (!(resume instanceof File) || !resume.size || resume.size > MAX_RESUME_BYTES) {
      return NextResponse.json({ error: 'Attach a resume no larger than 5 MB.' }, { status: 400 });
    }

    const extension = resume.name.split('.').pop()?.toLowerCase() || '';
    const bytes = Buffer.from(await resume.arrayBuffer());
    const isPdf = extension === 'pdf' && bytes.subarray(0, 5).toString() === '%PDF-';
    const isDocx = extension === 'docx' && bytes.subarray(0, 2).toString() === 'PK';
    const isDoc = extension === 'doc' && bytes.subarray(0, 4).toString('hex') === 'd0cf11e0';
    if (!isPdf && !isDocx && !isDoc) {
      return NextResponse.json({ error: 'Use a valid PDF, DOC or DOCX resume.' }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const emailHash = createHash('sha256')
      .update(`${process.env.VISITOR_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY}:${email}`)
      .digest('hex');
    const { data: allowed, error: rateError } = await admin.rpc('check_career_interest_rate_limit', { p_email_hash: emailHash });
    if (rateError) throw rateError;
    if (!allowed) return NextResponse.json({ error: 'You have reached the submission limit. Please try again in 24 hours.' }, { status: 429 });

    const contentType = isPdf ? 'application/pdf' : isDocx
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/msword';
    uploadedPath = `career-interest/${randomUUID()}/resume.${extension}`;
    const { error: uploadError } = await admin.storage.from('candidate-resumes').upload(uploadedPath, bytes, {
      contentType,
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data, error: insertError } = await admin.from('career_interest_submissions').insert({
      full_name: fullName,
      email,
      role_title: role,
      resume_path: uploadedPath,
    }).select('id').single();
    if (insertError) throw insertError;

    const emailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
    const emailSent = emailConfigured ? await notify(
      `RILORA career interest: ${role}`,
      `<p>A new role-interest submission was received.</p><p><b>Name:</b> ${escapeHtml(fullName)}</p><p><b>Email:</b> ${escapeHtml(email)}</p><p><b>Role interest:</b> ${escapeHtml(role)}</p><p><b>Reference:</b> ${escapeHtml(data.id)}</p><p>The candidate's resume is attached. It is also stored in the private candidate-resumes bucket for administrator access.</p>`,
      [{ filename: `RILORA-resume-${data.id}.${extension}`, content: bytes.toString('base64') }],
      'rilora.official@gmail.com',
    ) : false;
    return NextResponse.json({ ok: true, id: data.id, emailSent, emailConfigured });
  } catch (error) {
    if (uploadedPath) {
      try { await supabaseAdmin().storage.from('candidate-resumes').remove([uploadedPath]); } catch { /* Keep the original submission error. */ }
    }
    console.error('Career interest submission failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'We could not save your submission. Please try again later.' }, { status: 503 });
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}
