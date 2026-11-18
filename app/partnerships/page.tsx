'use client';

import { FormEvent, useEffect, useState } from 'react';

type Partner = { id: string; slug: string; name: string; description: string; logo_url: string | null; website_url: string | null; status: string };

function PartnershipEnquiryForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage('');
    const form = event.currentTarget;
    const values = new FormData(form);
    const body = Object.fromEntries(values);
    try {
      const response = await fetch('/api/partnerships', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Your partnership enquiry could not be submitted.');
      setMessage(`Your partnership enquiry was saved. Reference: ${result.partnershipId}. The RILORA team will review it.`);
      form.reset();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Your partnership enquiry could not be submitted.'); }
    finally { setBusy(false); }
  }
  return <section className="section partnership-enquiry-section"><div className="container grid two"><div><div className="eyebrow">Start a conversation</div><h2>Propose a partnership.</h2><p>Send your organization and collaboration details to the RILORA team. Submissions are reviewed before any partnership is shown publicly.</p></div><form className="card formgrid" onSubmit={submit}><div className="field"><label htmlFor="partnership-organization">Organization</label><input id="partnership-organization" name="organization_name" maxLength={160} required/></div><div className="field"><label htmlFor="partnership-contact">Contact person</label><input id="partnership-contact" name="contact_person" autoComplete="name" maxLength={120} required/></div><div className="field"><label htmlFor="partnership-email">Email</label><input id="partnership-email" type="email" name="email" autoComplete="email" maxLength={254} required/></div><div className="field"><label htmlFor="partnership-phone">Phone (optional)</label><input id="partnership-phone" name="phone" autoComplete="tel" maxLength={40}/></div><div className="field span2"><label htmlFor="partnership-type">Partnership type</label><select id="partnership-type" name="partnership_type" required defaultValue=""><option value="" disabled>Choose a type</option><option>Technology collaboration</option><option>Product development</option><option>Research collaboration</option><option>Service partnership</option><option>Other</option></select></div><div className="field span2"><label htmlFor="partnership-description">How would you like to collaborate?</label><textarea id="partnership-description" name="description" minLength={20} maxLength={4000} required/></div><div className="website-trap" aria-hidden="true"><label htmlFor="partnership-website">Website</label><input id="partnership-website" name="website_url" tabIndex={-1} autoComplete="off"/></div><div className="span2"><button className="btn" disabled={busy}>{busy ? 'Submitting…' : 'Submit partnership enquiry'}</button>{message&&<p className="notice" role="status" aria-live="polite">{message}</p>}</div></form></div></section>;
}

export default function Partnerships() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const refresh = () => fetch('/api/partnerships', { cache: 'no-store' }).then(response => response.json()).then(result => {
      if (!active) return;
      if (Array.isArray(result.data)) setPartners(result.data);
      if (Number.isInteger(result.partnershipCount)) setCount(result.partnershipCount);
      setLoading(false);
    }).catch(() => { if (active) setLoading(false); });
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 60000);
    window.addEventListener('focus', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  return <main>
    <section className="hero"><div className="container"><div className="eyebrow">Partnerships</div><h1>Building together.</h1><p>RILORA collaborates with organisations on digital and technology projects. Public partnership information is shown only after it has been approved.</p></div></section>
    <section className="section"><div className="container"><div className="sectionhead"><div className="eyebrow">Confirmed collaboration</div><h2>RILORA × CureTrics</h2><p>Healthcare Management Application</p><p className="partnership-count" aria-live="polite">{count===null?(loading?'Loading approved partnership count…':'Approved partnership count unavailable.'):`${count} approved or active ${count===1?'partnership':'partnerships'} in the database.`}</p></div><div className="grid two" style={{alignItems:'center'}}><img className="projectvisual" style={{height:330,objectFit:'contain'}} src="/brand/rilora-curetrics.jpeg" alt="RILORA and CureTrics collaboration branding"/><div><h3>Healthcare Management Application</h3><p>A healthcare technology project developed in collaboration with CureTrics.</p><p className="status">No clinical validation, hospital adoption, medical certification or production deployment is claimed.</p></div></div>{partners.filter(partner=>partner.slug!=='curetrics').length>0&&<div className="section"><div className="sectionhead"><div className="eyebrow">Other approved partners</div></div><div className="grid">{partners.filter(partner=>partner.slug!=='curetrics').map(partner=><article className="card" key={partner.id}>{partner.logo_url&&<img className="projectvisual" style={{height:140,objectFit:'contain'}} src={partner.logo_url} alt={`${partner.name} approved logo`}/>}<h3>{partner.name}</h3><p>{partner.description}</p>{partner.website_url&&<a className="status" href={partner.website_url} target="_blank" rel="noreferrer">Visit website →</a>}</article>)}</div></div>}</div></section>
    <PartnershipEnquiryForm/>
  </main>;
}
