import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireAdmin, supabase } from '@/lib/supabase';
export async function POST(request: Request) {
  const auth = await requireAdmin(request); if (!auth.authorized) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  try { const body = await request.json(); if(body.kind==='job'&&!String(body.compensation||'').trim())return NextResponse.json({error:'Paid employment listings must include compensation information.'},{status:400}); if(body.certificate_eligible&&!String(body.certificate_criteria||'').trim())return NextResponse.json({error:'Certificate eligibility requires published completion criteria.'},{status:400}); if(body.vacancy_count!==undefined&&body.vacancy_count!==null&&(!Number.isInteger(body.vacancy_count)||body.vacancy_count<1))return NextResponse.json({error:'Vacancies must be a positive whole number.'},{status:400}); if(body.salary_min!=null&&body.salary_max!=null&&Number(body.salary_min)>Number(body.salary_max))return NextResponse.json({error:'Minimum compensation cannot exceed maximum compensation.'},{status:400}); if(body.image_url&&!safeJobImage(body.image_url))return NextResponse.json({error:'Upload a job image to the private job image workflow or use an existing RILORA brand image.'},{status:400}); body.job_id ||= `RILORA-${randomUUID().slice(0,8).toUpperCase()}`; const { data, error } = await supabase(auth.token).from('opportunities').insert(body).select().single(); if (error) throw error; return NextResponse.json({ data }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save opportunity.' }, { status: 400 }); }
}
export async function PATCH(request: Request) {
  const auth = await requireAdmin(request); if (!auth.authorized) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  try { const body = await request.json(); const { id, ...updates } = body; if (!id) return NextResponse.json({ error: 'Opportunity ID required.' }, { status: 400 }); if(updates.kind==='job'&&!String(updates.compensation||'').trim())return NextResponse.json({error:'Paid employment listings must include compensation information.'},{status:400}); if(updates.certificate_eligible&&!String(updates.certificate_criteria||'').trim())return NextResponse.json({error:'Certificate eligibility requires completion criteria.'},{status:400}); if(updates.image_url&&!safeJobImage(updates.image_url))return NextResponse.json({error:'Upload a valid job card image first.'},{status:400}); const { data, error } = await supabase(auth.token).from('opportunities').update({...updates,updated_at:new Date().toISOString()}).eq('id', id).select().single(); if (error) throw error; return NextResponse.json({ data }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update opportunity.' }, { status: 400 }); }
}
export async function DELETE(request: Request) {
  const auth = await requireAdmin(request); if (!auth.authorized) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  try { const { id } = await request.json(); const { error } = await supabase(auth.token).from('opportunities').delete().eq('id', id); if (error) throw error; return NextResponse.json({ ok: true }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to delete opportunity.' }, { status: 400 }); }
}

function safeJobImage(value: unknown) {
  if (typeof value !== 'string') return false;
  if (/^\/brand\/[a-z0-9._/-]+$/i.test(value)) return true;
  try {
    const image = new URL(value);
    const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
    return image.protocol === 'https:' && image.hostname === project.hostname && image.pathname.includes('/storage/v1/object/public/job-images/jobs/');
  } catch { return false; }
}
