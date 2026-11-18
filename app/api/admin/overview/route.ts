import { NextResponse } from 'next/server';
import { requireAdmin, supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  const db = supabase(auth.token);
  const [totalApps, newApps, review, shortlisted, interviews, selected, rejected, publishedJobs, closedJobs, totalEnquiries, unreadEnquiries, recentApps, recentEnquiries, recentJobs] = await Promise.all([
    db.from('opportunity_applications').select('id', { count: 'exact', head: true }),
    db.from('opportunity_applications').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
    db.from('opportunity_applications').select('id', { count: 'exact', head: true }).eq('status', 'under_review'),
    db.from('opportunity_applications').select('id', { count: 'exact', head: true }).eq('status', 'shortlisted'),
    db.from('opportunity_applications').select('id', { count: 'exact', head: true }).eq('status', 'interview'),
    db.from('opportunity_applications').select('id', { count: 'exact', head: true }).eq('status', 'selected'),
    db.from('opportunity_applications').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
    db.from('opportunities').select('id', { count: 'exact', head: true }).eq('is_published', true),
    db.from('opportunities').select('id', { count: 'exact', head: true }).eq('is_closed', true),
    db.from('service_enquiries').select('id', { count: 'exact', head: true }),
    db.from('service_enquiries').select('id', { count: 'exact', head: true }).is('read_at', null),
    db.from('opportunity_applications').select('id,status,created_at,applicant_full_name,applicant_email,opportunities(title)').order('created_at', { ascending: false }).limit(5),
    db.from('service_enquiries').select('id,enquiry_id,name,email,subject,service_required,status,read_at,created_at').order('created_at', { ascending: false }).limit(5),
    db.from('opportunities').select('id,job_id,title,kind,department,is_published,is_closed,created_at').order('created_at', { ascending: false }).limit(5),
  ]);
  const failures = [totalApps,newApps,review,shortlisted,interviews,selected,rejected,publishedJobs,closedJobs,totalEnquiries,unreadEnquiries,recentApps,recentEnquiries,recentJobs].find(result => result.error);
  if (failures?.error) return NextResponse.json({ error: 'Could not load administrator statistics. Apply the latest database migration.' }, { status: 503 });
  return NextResponse.json({
    counts: { applications: totalApps.count || 0, newApplications: newApps.count || 0, underReview: review.count || 0, shortlisted: shortlisted.count || 0, interviews: interviews.count || 0, selected: selected.count || 0, rejected: rejected.count || 0, publishedJobs: publishedJobs.count || 0, closedJobs: closedJobs.count || 0, enquiries: totalEnquiries.count || 0, unreadEnquiries: unreadEnquiries.count || 0 },
    recentApplications: recentApps.data || [], recentEnquiries: recentEnquiries.data || [], recentJobs: recentJobs.data || [],
  });
}
