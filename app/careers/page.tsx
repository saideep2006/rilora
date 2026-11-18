'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { EmailHighlightedText } from '@/components';
import { CAREER_INTEREST_ROLES } from '@/lib/career-roles';

type Opportunity = {
  id: string; job_id?: string; slug: string; title: string; kind: string; department: string; job_category?: string; employment_type?: string; image_url?: string;
  description: string; required_skills: string[]; experience_level: string;
  engagement_type: string; work_mode: string; duration: string; location: string;
  compensation: string; application_deadline: string; created_at: string; city?: string; state?: string; country?: string;
};

const areas = [
  ['Technology & Development', 'Frontend, backend and full stack development', 'React, Python and application development', 'AI/ML and software testing'],
  ['Marketing & Creative', 'Digital marketing, SEO and social media', 'Content creation and community management', 'Graphic design, branding and video editing'],
  ['Business & Operations', 'Business development and startup research', 'Market research, partnerships and outreach', 'HR, recruitment and project coordination'],
];

export default function Careers() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ department: '', kind: '', mode: '', location: '', experience: '' });
  const [error, setError] = useState('');
  const [intro, setIntro] = useState('Have a passion for technology, creativity or business? Join RILORA’s contributor community, work on practical projects and build experience.');
  const [role, setRole] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/opportunities', { signal: controller.signal }).then((r) => r.json()).then((d) => {
      if (d.error) setError(d.error);
      setItems(d.data || []);
    }).catch((e) => { if (e.name !== 'AbortError') setError('Could not load published opportunities.'); });
    fetch('/api/content', { signal: controller.signal }).then((r) => r.json()).then((d) => {
      if (d.data?.careers_intro) setIntro(d.data.careers_intro);
    }).catch(() => {});
    return () => controller.abort();
  }, []);

  const departments = Array.from(new Set(items.map((item) => item.department)));
  const filtered = useMemo(() => items.filter((item) =>
    (!query || [item.title, item.department, item.description, item.location, item.required_skills?.join(' ')].join(' ').toLowerCase().includes(query.trim().toLowerCase())) &&
    (!filters.department || item.department === filters.department) &&
    (!filters.kind || item.kind === filters.kind) &&
    (!filters.mode || item.work_mode === filters.mode) &&
    (!filters.location || item.location === filters.location) &&
    (!filters.experience || item.experience_level === filters.experience)
  ), [items, filters, query]);

  function setFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function selectRole(value: string) {
    setRole(value);
    setFormMessage('');
    document.getElementById('career-interest-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => document.getElementById('candidate-name')?.focus(), 250);
  }

  async function submitInterest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = (new FormData(form).get('resume')) as File | null;
    if (!file || file.size > 5 * 1024 * 1024) {
      setFormMessage('Attach a PDF, DOC or DOCX resume no larger than 5 MB.');
      return;
    }
    setSubmitting(true);
    setFormMessage('');
    try {
      const response = await fetch('/api/career-interest', { method: 'POST', body: new FormData(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'We could not save your submission.');
      setFormMessage(result.emailSent
        ? `Your role interest and resume were sent to rilora.official@gmail.com. Reference: ${result.id}`
        : result.emailConfigured
          ? `Your role interest was saved, but email delivery could not be confirmed. An administrator can still review it securely. Reference: ${result.id}`
          : `Your role interest was saved. Email delivery to rilora.official@gmail.com will start after the email provider is configured. Reference: ${result.id}`);
      form.reset();
      setRole('');
    } catch (e) {
      setFormMessage(e instanceof Error ? e.message : 'We could not submit your role interest. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return <main>
    <section className="hero"><div className="container"><div className="eyebrow">Careers & opportunities</div><h1>Be Part of RILORA.<br/>Build. Learn. Grow.</h1><p>{intro}</p><div className="heroactions"><a className="btn" href="#openings">View opportunities</a><Link className="btn secondary" href="/account">Applicant account (optional)</Link></div></div></section>

    <section className="section"><div className="container"><div className="sectionhead"><div className="eyebrow">Opportunity portal</div><h2>Published opportunities</h2><p>These are administrator-published jobs, internships and project-based contributions. Each listing states its engagement type, work mode, compensation and completion terms.</p></div><div className="filters" id="openings"><input className="career-search" type="search" aria-label="Search opportunities" placeholder="Search roles, skills or location" value={query} onChange={(e) => setQuery(e.target.value)}/><select aria-label="Department" value={filters.department} onChange={(e) => setFilter('department', e.target.value)}><option value="">All departments</option>{departments.map((d) => <option key={d}>{d}</option>)}</select><select aria-label="Engagement" value={filters.kind} onChange={(e) => setFilter('kind', e.target.value)}><option value="">All opportunity types</option><option value="job">Paid employment</option><option value="internship">Internships</option><option value="contributor">Contributor opportunities</option></select><select aria-label="Work mode" value={filters.mode} onChange={(e) => setFilter('mode', e.target.value)}><option value="">All work modes</option>{Array.from(new Set(items.map((x) => x.work_mode).filter(Boolean))).map((x) => <option key={x}>{x}</option>)}</select><select aria-label="Experience" value={filters.experience} onChange={(e) => setFilter('experience', e.target.value)}><option value="">All experience levels</option>{Array.from(new Set(items.map((x) => x.experience_level).filter(Boolean))).map((x) => <option key={x}>{x}</option>)}</select><select aria-label="Location" value={filters.location} onChange={(e) => setFilter('location', e.target.value)}><option value="">All locations</option>{Array.from(new Set(items.map((x) => x.location).filter(Boolean))).map((x) => <option key={x}>{x}</option>)}</select></div>{error && <div className="notice" role="status">{error}</div>}{filtered.length === 0 ? <div className="empty">{items.length ? 'No opportunities match these filters.' : 'No active job opportunities available.'}<br/><span className="status">These role interest areas below are not vacancies. Only administrator-published opportunities accept applications.</span></div> : <div className="grid two">{filtered.map((o) => <article className="card career-card" key={o.id}>{o.image_url&&<Image src={o.image_url} unoptimized alt={`${o.title} opportunity banner`} width={900} height={450} className="career-banner-image"/>}<div><span className="tag">{o.kind === 'job' ? 'Paid employment' : o.kind === 'internship' ? 'Internship' : 'Project contributor'}</span><span className="tag">{o.employment_type||o.work_mode}</span></div><h3>{o.title}</h3><p><strong>{o.department}</strong> · {o.experience_level || 'Details in listing'}</p><p>{o.description}</p><div className="career-meta"><span>{[o.city,o.state,o.country].filter(Boolean).join(', ')||o.location||'Location not specified'}</span><span>{o.duration || 'Duration in listing'}</span>{o.compensation && <span>{o.compensation}</span>}{o.application_deadline && <span>Apply by {new Date(o.application_deadline).toLocaleDateString()}</span>}{o.created_at && <span>Posted {new Date(o.created_at).toLocaleDateString()}</span>}</div><div style={{marginTop: 15}}><Link className="btn small" href={`/careers/${o.slug}`}>View details &amp; apply</Link></div></article>)}</div>}</div></section>

    <section className="section tint" id="role-interests"><div className="container"><div className="sectionhead"><div className="eyebrow">Register your interest</div><h2>Role areas we welcome interest in</h2><p>These cards invite expressions of interest only. They are not active job postings, paid roles or internship offers. Submit your name, email and resume to be considered for future opportunities.</p></div><div className="grid role-interest-grid">{CAREER_INTEREST_ROLES.map((title) => <article className="card role-interest-card" key={title}><span className="tag">Interest area · Not a vacancy</span><h3>{title}</h3><button className="btn small" type="button" onClick={() => selectRole(title)}>Register interest</button></article>)}</div><form id="career-interest-form" className="card career-interest-form" onSubmit={submitInterest}><h3>Send your role interest</h3><p className="status">Your resume is stored privately. When email is configured, RILORA sends your submission and resume to its recruitment inbox. Authorized administrators can also review it in the dashboard.</p><div className="formgrid"><div className="field"><label htmlFor="candidate-name">Full name *</label><input id="candidate-name" name="full_name" autoComplete="name" minLength={2} maxLength={120} required/></div><div className="field"><label htmlFor="candidate-email">Email address *</label><input id="candidate-email" name="email" type="email" autoComplete="email" maxLength={254} required/></div><div className="field"><label htmlFor="candidate-role">Role interest *</label><select id="candidate-role" name="role_title" value={role} onChange={(e) => setRole(e.target.value)} required><option value="">Select a role interest</option>{CAREER_INTEREST_ROLES.map((title) => <option key={title} value={title}>{title}</option>)}</select></div><div className="field"><label htmlFor="candidate-resume">Resume (PDF, DOC or DOCX; max 5 MB) *</label><input id="candidate-resume" name="resume" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required/></div><div className="field span2 consent-field"><label><input name="consent" type="checkbox" required/> I consent to RILORA storing my name, email and resume for review and contact about relevant roles, and to sharing this submission with its configured email provider for delivery to <EmailHighlightedText text="rilora.official@gmail.com"/>.</label></div><div className="honeypot" aria-hidden="true"><label htmlFor="website_url">Website</label><input id="website_url" name="website_url" tabIndex={-1} autoComplete="off"/></div></div><button className="btn" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit role interest'}</button>{formMessage && <p className="message" role="status" aria-live="polite"><EmailHighlightedText text={formMessage}/></p>}</form></div></section>

    <section className="section"><div className="container"><div className="sectionhead"><div className="eyebrow">Areas of interest</div><h2>Bring your skills to a project.</h2><p>These broader disciplines are also welcome. This list does not announce vacancies; apply only to published listings above or register interest in a role area.</p></div><div className="grid">{areas.map(([name, ...list]) => <article className="card" key={name}><h3>{name}</h3>{list.map((text) => <p key={text}>• {text}</p>)}</article>)}</div><div className="card" style={{marginTop: 18}}><h3>Learn Through Experience. Grow Through Contribution.</h3><p>Potential benefits depend on the opportunity: practical experience, collaboration, portfolio work, skill development, mentorship where available, and certificates for eligible participants who meet published completion criteria. Certificates are not automatic.</p></div></div></section>

    <section className="section"><div className="container"><div className="sectionhead"><div className="eyebrow">How it works</div><h2>From application to contribution.</h2></div><div className="steps">{[['01','Discover','Review the opportunity terms, responsibilities and eligibility.'],['02','Apply','Complete the form for a published opening. No account or password is required.'],['03','Contribute','The RILORA team reviews applications and contacts candidates by email.'],['04','Complete','Selected contributors may be allocated to eligible projects; certificates require published completion criteria.']].map((step) => <div className="step" key={step[0]}><b>{step[0]}</b><h3>{step[1]}</h3><p>{step[2]}</p></div>)}</div></div></section>
  </main>;
}
