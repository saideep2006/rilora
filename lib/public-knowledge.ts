import { supabase, supabaseConfigured } from '@/lib/supabase';

type PublicRecord = Record<string, unknown>;
const safeText = (value: unknown, max = 1200) => typeof value === 'string' ? value.replace(/[<>]/g, '').slice(0, max) : '';

/** Build the assistant context only from explicitly public records and public-safe columns. */
export async function getPublicWebsiteKnowledge() {
  const knowledge: Record<string, unknown> = {
    company: 'RILORA is a technology and digital-solutions company offering website development and digital solutions for startups and businesses.',
    about: 'RILORA builds modern websites and digital products. Its confirmed projects are the RILORA Messaging Application and a Healthcare Management Application developed in collaboration with CureTrics.',
    contact: { email: 'rilora.official@gmail.com', supportRoute: '/contact', enquiry: 'Visitors can submit project, service, career, partnership, or general enquiries through the Support page.' },
    navigation: ['Home', 'Services', 'Careers', 'Partnerships', 'Support'],
    recruitment: 'Only published opportunity listings are current openings. A role-interest card is not a vacancy. Listings distinguish paid employment, internships, and project-based contributions and define their own eligibility and terms.',
  };
  if (!supabaseConfigured()) return knowledge;
  try {
    const db = supabase();
    const [content, services, opportunities, partnerships] = await Promise.all([
      db.from('site_content').select('content_key,content_value').eq('is_public', true).limit(50),
      db.from('services').select('name,description').eq('is_published', true).order('sort_order').limit(50),
      db.from('opportunities').select('job_id,title,kind,department,description,eligibility,requirements,required_skills,experience_level,engagement_type,work_mode,duration,location,compensation,application_deadline,application_instructions').eq('is_published', true).eq('is_closed', false).or(`application_deadline.is.null,application_deadline.gte.${new Date().toISOString().slice(0,10)}`).order('created_at', { ascending: false }).limit(50),
      db.from('partnerships').select('name,description').eq('is_published', true).limit(30),
    ]);
    if (content.data) {
      const publicContent = Object.fromEntries(content.data
        .filter(row => !/(admin|private|internal|secret|password|applicant|resume|credential)/i.test(row.content_key))
        .map(row => [safeText(row.content_key, 80), safeText(row.content_value, 1800)]));
      knowledge.websiteContent = publicContent;
    }
    if (services.data) knowledge.services = services.data.map((row: PublicRecord) => ({ name: safeText(row.name, 120), description: safeText(row.description) }));
    if (opportunities.data) knowledge.currentOpportunities = opportunities.data.map((row: PublicRecord) => ({
      jobId: safeText(row.job_id || row.id, 80), title: safeText(row.title, 160), type: safeText(row.kind, 40), department: safeText(row.department, 120),
      description: safeText(row.description), eligibility: safeText(row.eligibility), requirements: Array.isArray(row.requirements) ? row.requirements.map(x => safeText(x, 180)).slice(0, 20) : [],
      skills: Array.isArray(row.required_skills) ? row.required_skills.map(x => safeText(x, 80)).slice(0, 30) : [], experience: safeText(row.experience_level),
      engagement: safeText(row.engagement_type), workMode: safeText(row.work_mode), duration: safeText(row.duration), location: safeText(row.location),
      compensation: safeText(row.compensation), deadline: safeText(row.application_deadline, 32), applicationInstructions: safeText(row.application_instructions),
    }));
    if (partnerships.data) knowledge.partnerships = partnerships.data.map((row: PublicRecord) => ({ name: safeText(row.name, 120), description: safeText(row.description) }));
  } catch {
    // Keep verified baseline facts; never turn a database outage into invented job or service data.
  }
  return knowledge;
}
