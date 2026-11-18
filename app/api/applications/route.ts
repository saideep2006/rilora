import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { hasServerSupabaseConfig } from '@/lib/public-config';
import { currentUser, recordApplicationEmail, sendEmail, supabase, supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export async function GET(request: Request) {
  try {
    const { user, token } = await currentUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to view applications.' }, { status: 401 });
    const { data, error } = await supabase(token)
      .from('opportunity_applications')
      .select('id,status,created_at,cover_letter,opportunities(id,title,slug,kind,department),application_status_history(id,previous_status,new_status,changed_at)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load applications.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (request.headers.get('content-type')?.includes('multipart/form-data')) return submitPublicApplication(request);
  try {
    const { user, token } = await currentUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in before applying.' }, { status: 401 });
    const body = await request.json();
    if (typeof body.opportunity_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.opportunity_id)) {
      return NextResponse.json({ error: 'Choose an opportunity.' }, { status: 400 });
    }
    if (body.resume_path !== undefined && body.resume_path !== null && (typeof body.resume_path !== 'string' || !body.resume_path.startsWith(`${user.id}/`))) {
      return NextResponse.json({ error: 'Resume path does not belong to this account.' }, { status: 400 });
    }
    if (body.cover_letter !== undefined && (typeof body.cover_letter !== 'string' || body.cover_letter.length > 5000)) {
      return NextResponse.json({ error: 'Application note must be 5,000 characters or fewer.' }, { status: 400 });
    }

    const client = supabase(token);
    const { data: opportunity, error: opportunityError } = await client.from('opportunities').select('title').eq('id', body.opportunity_id).single();
    if (opportunityError) throw opportunityError;
    const { data, error } = await client.from('opportunity_applications').insert({
      opportunity_id: body.opportunity_id,
      applicant_id: user.id,
      cover_letter: body.cover_letter?.trim() || null,
      resume_path: body.resume_path || null,
    }).select('id,created_at').single();
    if (error) throw error;

    const candidateName = String(user.user_metadata?.full_name || user.email || 'Candidate');
    const adminInbox = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.NOTIFICATION_EMAIL || 'rilora.official@gmail.com';
    const dashboardUrl = getConfiguredSiteUrl();
    const acknowledgementSubject = 'RILORA – Application Received Successfully';
    const adminSubject = 'New RILORA opportunity application';
    const acknowledgementHtml = `<p>Dear ${escapeHtml(candidateName)},</p><p>Your application for <strong>${escapeHtml(opportunity.title)}</strong> was received successfully.</p><p><strong>Application ID:</strong> ${escapeHtml(data.id)}</p><p><strong>Submitted:</strong> ${escapeHtml(new Date(data.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))}</p><p>Your application is under review. Sign in to your RILORA account to track its status.</p><p>Regards,<br/>RILORA Recruitment Team</p>`;
    const adminHtml = `<p>A new application has been submitted.</p><p><strong>Candidate:</strong> ${escapeHtml(candidateName)}</p><p><strong>Position:</strong> ${escapeHtml(opportunity.title)}</p><p><strong>Application ID:</strong> ${escapeHtml(data.id)}</p><p><strong>Submitted:</strong> ${escapeHtml(new Date(data.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))}</p>${dashboardUrl ? `<p><a href="${escapeHtml(`${dashboardUrl}/admin`)}">Open the protected Admin Dashboard</a></p>` : '<p>Configure NEXT_PUBLIC_SITE_URL to include a direct dashboard link.</p>'}`;
    const [acknowledgement, adminNotice] = await Promise.all([
      user.email ? sendEmail(user.email, acknowledgementSubject, acknowledgementHtml) : Promise.resolve({ configured: false, sent: false }),
      sendEmail(adminInbox, adminSubject, adminHtml),
    ]);
    if (hasServerSupabaseConfig()) {
      await Promise.all([
        user.email ? recordApplicationEmail({ applicationId: data.id, recipient: user.email, emailType: 'application_acknowledgement', subject: acknowledgementSubject, result: acknowledgement }) : Promise.resolve(),
        recordApplicationEmail({ applicationId: data.id, recipient: adminInbox, emailType: 'admin_notification', subject: adminSubject, result: adminNotice }),
      ]);
    }
    return NextResponse.json({ ok: true, id: data.id, acknowledgementSent: acknowledgement.sent, emailConfigured: acknowledgement.configured });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to submit application.' }, { status: 400 });
  }
}

async function submitPublicApplication(request: Request) {
  if (!hasServerSupabaseConfig()) return NextResponse.json({ error: 'Applications are not connected yet. Please try again later.' }, { status: 503 });
  const origin = request.headers.get('origin');
  let expectedOrigin = '';
  try { expectedOrigin = process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin : new URL(request.url).origin; } catch { /* handled as origin mismatch below */ }
  if (origin && origin !== expectedOrigin) return NextResponse.json({ error: 'This application could not be verified.' }, { status: 403 });
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_RESUME_BYTES + 40_000) return NextResponse.json({ error: 'Resume must be 5 MB or smaller.' }, { status: 413 });
  let resumePath: string | null = null;
  try {
    const form = await request.formData();
    if (String(form.get('website_url') || '').trim()) return NextResponse.json({ ok: true });
    const text = (name: string, max: number) => String(form.get(name) || '').trim().slice(0, max);
    const fullName = text('full_name', 120).replace(/\s+/g, ' ');
    const email = text('email', 254).toLowerCase();
    const phone = text('phone', 40);
    const opportunityId = text('opportunity_id', 36);
    const qualification = text('qualification', 160);
    const institution = text('institution', 200);
    const graduationYear = text('graduation_year', 20);
    const skills = text('skills', 1500);
    const experience = text('experience', 2000);
    const linkedIn = text('linkedin_url', 500);
    const gitHub = text('github_url', 500);
    const portfolio = text('portfolio_url', 500);
    const note = text('additional_information', 5000);
    const resume = form.get('resume');
    if (fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone || !qualification || !institution || !/^[0-9a-f-]{36}$/i.test(opportunityId)) return NextResponse.json({ error: 'Complete all required fields with a valid name, email and application.' }, { status: 400 });
    for (const url of [linkedIn, gitHub, portfolio].filter(Boolean)) if (!/^https:\/\//i.test(url)) return NextResponse.json({ error: 'Profile links must begin with https://.' }, { status: 400 });
    if (!(resume instanceof File) || !resume.size || resume.size > MAX_RESUME_BYTES) return NextResponse.json({ error: 'Attach a resume no larger than 5 MB.' }, { status: 400 });
    const ext = resume.name.split('.').pop()?.toLowerCase() || '';
    const bytes = Buffer.from(await resume.arrayBuffer());
    const isPdf = ext === 'pdf' && bytes.subarray(0, 5).toString() === '%PDF-';
    const isDocx = ext === 'docx' && bytes.subarray(0, 2).toString() === 'PK';
    const isDoc = ext === 'doc' && bytes.subarray(0, 4).toString('hex') === 'd0cf11e0';
    if (!isPdf && !isDocx && !isDoc) return NextResponse.json({ error: 'Use a valid PDF, DOC or DOCX resume.' }, { status: 400 });
    const admin = supabaseAdmin();
    const emailHash = createHash('sha256').update(`${process.env.VISITOR_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY}:${email}`).digest('hex');
    const { data: allowed, error: rateError } = await admin.rpc('check_career_interest_rate_limit', { p_email_hash: emailHash });
    if (rateError) throw rateError;
    if (!allowed) return NextResponse.json({ error: 'You have reached the application limit. Please try again in 24 hours.' }, { status: 429 });
    const { data: job, error: jobError } = await admin.from('opportunities').select('id,job_id,title,kind,department,is_published,is_closed,application_deadline,positions').eq('id', opportunityId).single();
    if (jobError || !job || !job.is_published || job.is_closed || (job.application_deadline && job.application_deadline < new Date().toISOString().slice(0, 10))) return NextResponse.json({ error: 'This opportunity is no longer accepting applications.' }, { status: 410 });
    if (job.positions) {
      const { count, error: countError } = await admin.from('opportunity_applications').select('id', { count: 'exact', head: true }).eq('opportunity_id', opportunityId);
      if (countError) throw countError;
      if ((count || 0) >= job.positions) return NextResponse.json({ error: 'This opportunity has received its stated number of applications.' }, { status: 410 });
    }
    const mime = isPdf ? 'application/pdf' : isDocx ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/msword';
    resumePath = `applications/${opportunityId}/${randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage.from('candidate-resumes').upload(resumePath, bytes, { contentType: mime, upsert: false });
    if (uploadError) throw uploadError;
    const { data, error } = await admin.from('opportunity_applications').insert({
      opportunity_id: opportunityId, applicant_id: null, applicant_full_name: fullName, applicant_email: email, applicant_phone: phone,
      qualification, institution, graduation_year: graduationYear || null, applicant_skills: skills || null, applicant_experience: experience || null,
      linkedin_url: linkedIn || null, github_url: gitHub || null, portfolio_url: portfolio || null,
      additional_information: note || null, cover_letter: note || null, resume_path: resumePath,
    }).select('id,created_at').single();
    if (error) throw error;
    const date = new Date(data.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const applicantSubject = 'RILORA – Application Received Successfully';
    const adminSubject = `New application: ${job.title}`;
    const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[char]!);
    const [candidateEmail, adminEmail] = await Promise.all([
      sendEmail(email, applicantSubject, `<p>Dear ${escape(fullName)},</p><p>We received your application for <strong>${escape(job.title)}</strong>.</p><p>Application ID: <strong>${escape(data.id)}</strong><br/>Submitted: ${escape(date)}</p><p>Your application is now in review. The RILORA team will contact you if there are updates.</p><p>Regards,<br/>RILORA Recruitment Team</p>`),
      sendEmail(process.env.ADMIN_NOTIFICATION_EMAIL || process.env.NOTIFICATION_EMAIL || 'rilora.official@gmail.com', adminSubject, `<p>A new application was received.</p><p>Candidate: ${escape(fullName)}<br/>Position: ${escape(job.title)}<br/>Application ID: ${escape(data.id)}<br/>Submitted: ${escape(date)}</p><p>Review it in the protected RILORA Admin Dashboard. Resume access is restricted there.</p>`),
    ]);
    await Promise.all([
      recordApplicationEmail({ applicationId: data.id, recipient: email, emailType: 'application_acknowledgement', subject: applicantSubject, result: candidateEmail }),
      recordApplicationEmail({ applicationId: data.id, recipient: process.env.ADMIN_NOTIFICATION_EMAIL || 'rilora.official@gmail.com', emailType: 'admin_notification', subject: adminSubject, result: adminEmail }),
    ]);
    return NextResponse.json({ ok: true, id: data.id, acknowledgementSent: candidateEmail.sent, emailConfigured: candidateEmail.configured });
  } catch (error) {
    if (resumePath) { try { await supabaseAdmin().storage.from('candidate-resumes').remove([resumePath]); } catch { /* preserve the submission failure */ } }
    console.error('Public application submission failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'We could not save your application. Please try again later.' }, { status: 503 });
  }
}

function getConfiguredSiteUrl() {
  try {
    const parsed = new URL(process.env.NEXT_PUBLIC_SITE_URL || '');
    return parsed.protocol === 'https:' || parsed.hostname === 'localhost' ? parsed.origin : '';
  } catch { return ''; }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}
