'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type Opp = {
  id: string; job_id?: string; slug: string; title: string; kind: string; department: string; employment_type?: string; job_category?: string; image_url?: string; description: string;
  responsibilities: string[]; required_skills: string[]; eligibility: string; experience_level: string;
  engagement_type: string; work_mode: string; duration: string; location: string; compensation: string;
  application_deadline: string; positions: number; requirements: string[]; certificate_eligible: boolean;
  certificate_criteria: string; mentorship: string; created_at: string;
};

export default function OpportunityDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [item, setItem] = useState<Opp | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showApply, setShowApply] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/opportunities').then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load this opportunity.');
      if (active) setItem((result.data || []).find((opportunity: Opp) => opportunity.slug === slug) || null);
    }).catch(error => { if (active) setMessage(error instanceof Error ? error.message : 'Unable to load this opportunity.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item || submitting) return;
    setSubmitting(true);
    setMessage('');
    try {
      const form = new FormData(event.currentTarget);
      form.set('opportunity_id', item.id);
      const response = await fetch('/api/applications', {
        method: 'POST', body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to submit this application.');
      setMessage(`Application received. Save your Application ID: ${result.id}. ${result.acknowledgementSent ? 'A confirmation email has been sent.' : result.emailConfigured ? 'Email delivery could not be confirmed.' : 'Email confirmation is not configured yet.'}`);
      setShowApply(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to submit your application. Please try again.');
    } finally { setSubmitting(false); }
  }

  if (loading) return <main className="section"><div className="container"><div className="empty">Loading opportunity…</div></div></main>;
  if (!item) return <main className="section"><div className="container"><div className="empty">{message || 'This opportunity is not currently published.'} <Link href="/careers">Return to opportunities</Link></div></div></main>;
  return <main>
    <section className="hero"><div className="container">
      <div className="eyebrow">{item.kind === 'job' ? 'Paid employment' : item.kind === 'internship' ? 'Internship' : 'Project-based contribution'}</div>
      {item.image_url&&<img className="job-detail-image" src={item.image_url} alt={`${item.title} opportunity banner`}/>} 
      <h1>{item.title}</h1><p>RILORA · {item.department} · {item.work_mode} · {item.location || 'Location details in listing'}</p>
      <div className="heroactions"><button onClick={() => setShowApply(v => !v)} className="btn">{showApply ? 'Close application' : 'Apply now'}</button><Link className="btn secondary" href="/careers">All opportunities</Link></div>
      {message && <div className="notice" role="status">{message}</div>}
    </div></section>
    <section className="section"><div className="container grid two"><div>
      <h2>About this opportunity</h2><p>{item.description}</p>
      <h3>Responsibilities</h3><ul>{item.responsibilities?.map(x => <li key={x}>{x}</li>)}</ul>
      <h3>Requirements</h3><ul>{item.requirements?.map(x => <li key={x}>{x}</li>)}</ul>
      <p><b>Skills:</b> {item.required_skills?.join(', ') || 'See description'}</p>
      {item.certificate_eligible && <p><b>Certificate eligibility:</b> {item.certificate_criteria}. Certificates require completion and review; they are not automatic.</p>}
    </div><aside className="card"><h3>Opportunity details</h3>
      <p><b>Job ID:</b> {item.job_id||item.id.slice(0, 8).toUpperCase()}</p><p><b>Department:</b> {item.department}</p>
      <p><b>Engagement:</b> {item.employment_type||item.engagement_type}</p><p><b>Work mode:</b> {item.work_mode}</p>
      <p><b>Location:</b> {item.location || 'Not specified'}</p><p><b>Duration:</b> {item.duration || 'Not specified'}</p>
      <p><b>Experience:</b> {item.experience_level || 'Not specified'}</p><p><b>Compensation:</b> {item.compensation || 'Not disclosed'}</p>
      <p><b>Eligibility:</b> {item.eligibility || 'See requirements'}</p>
      {item.created_at && <p><b>Posted:</b> {new Date(item.created_at).toLocaleDateString()}</p>}
      {item.application_deadline && <p><b>Apply by:</b> {new Date(item.application_deadline).toLocaleDateString()}</p>}
      {item.mentorship && <p><b>Mentorship:</b> {item.mentorship}</p>}
    </aside></div></section>
    {showApply && <section className="section tint"><div className="container"><form className="card application-form" onSubmit={apply}>
      <h2>Apply for {item.title}</h2><p>No account is needed. Your application is for Job ID {item.job_id||item.id.slice(0,8).toUpperCase()}, is stored securely and returns an application reference.</p>
      <div className="formgrid">
        <div className="field"><label htmlFor="application-name">Full name *</label><input id="application-name" name="full_name" autoComplete="name" minLength={2} maxLength={120} required/></div>
        <div className="field"><label htmlFor="application-email">Email address *</label><input id="application-email" name="email" type="email" autoComplete="email" maxLength={254} required/></div>
        <div className="field"><label htmlFor="application-phone">Mobile number *</label><input id="application-phone" name="phone" type="tel" autoComplete="tel" maxLength={40} required/></div>
        <div className="field"><label htmlFor="application-qualification">Qualification *</label><input id="application-qualification" name="qualification" maxLength={160} required/></div>
        <div className="field"><label htmlFor="application-institution">College or university *</label><input id="application-institution" name="institution" maxLength={200} required/></div>
        <div className="field"><label htmlFor="application-year">Graduation year</label><input id="application-year" name="graduation_year" maxLength={20}/></div>
        <div className="field span2"><label htmlFor="application-skills">Skills</label><textarea id="application-skills" name="skills" maxLength={1500}/></div>
        <div className="field span2"><label htmlFor="application-experience">Experience</label><textarea id="application-experience" name="experience" maxLength={2000}/></div>
        <div className="field"><label htmlFor="application-linkedin">LinkedIn profile</label><input id="application-linkedin" name="linkedin_url" type="url" maxLength={500}/></div>
        <div className="field"><label htmlFor="application-github">GitHub profile</label><input id="application-github" name="github_url" type="url" maxLength={500}/></div>
        <div className="field span2"><label htmlFor="application-portfolio">Portfolio</label><input id="application-portfolio" name="portfolio_url" type="url" maxLength={500}/></div>
        <div className="field span2"><label htmlFor="resume">Resume (PDF, DOC or DOCX; max 5 MB) *</label><input id="resume" name="resume" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required/></div>
        <div className="field span2"><label htmlFor="application-note">Additional information</label><textarea id="application-note" name="additional_information" maxLength={5000}/></div>
        <div className="honeypot" aria-hidden="true"><label htmlFor="application-website">Website</label><input id="application-website" name="website_url" tabIndex={-1} autoComplete="off"/></div>
      </div>
      <button className="btn" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit application'}</button>
    </form></div></section>}
  </main>;
}
