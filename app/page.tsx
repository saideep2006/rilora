'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {ArrowRight,Code2,Sparkles,UsersRound,LockKeyhole} from 'lucide-react';
import {PublicPartnershipCount} from '@/components';

export default function Home(){
  const [copy,setCopy]=useState<Record<string,string>>({});
  useEffect(()=>{fetch('/api/content').then(r=>r.json()).then(d=>setCopy(d.data||{})).catch(()=>{});},[]);
  return <main>
    <section className="hero">
      <div className="container hero-layout">
        <div className="hero-copy">
          <div className="hero-eyebrow-row"><div className="eyebrow">Technology &amp; digital solutions</div><Link href="/admin/login" className="hero-admin-link"><LockKeyhole size={14}/> Admin sign in</Link></div>
          <h1>{copy.home_headline||<>Building Digital Experiences.<br/><span style={{color:'#f5cf6b'}}>Empowering Future Innovators.</span></>}</h1>
          <p>{copy.home_subtitle||'From startup websites to innovative applications, RILORA transforms ideas into digital experiences while creating opportunities for talented individuals to learn, contribute and grow.'}</p>
          <div className="heroactions"><Link href="/services" className="btn">Explore our services <ArrowRight size={16}/></Link><Link href="/careers" className="btn secondary">Find an opportunity</Link></div>
          <div className="hero-features"><span><Code2 size={17}/>Websites &amp; digital platforms</span><span><Sparkles size={17}/>Software products</span><span><UsersRound size={17}/>Contributor opportunities</span></div>
        </div>
        <div className="hero-logo-stage" aria-label="RILORA logo animation">
          <div className="hero-logo-orbit" aria-hidden="true"/>
          <div className="hero-logo-halo" aria-hidden="true"/>
          <Image className="hero-logo-image" src="/brand/rilora-hero.png" alt="RILORA logo" width={900} height={786} priority sizes="(max-width: 700px) 76vw, (max-width: 1000px) 42vw, 460px"/>
        </div>
      </div>
    </section>
    <section className="section"><div className="container"><div className="sectionhead"><div className="eyebrow">What we do</div><h2>Your Idea. Our Technology. A Digital Future.</h2><p>We help startups and growing businesses establish their digital presence through modern websites and thoughtful technology solutions.</p></div><div className="grid">{[['Startup Website Development','Professional sites that help new businesses get online with confidence.'],['Web Applications','Custom web experiences built around your users and business needs.'],['UI/UX & Digital Design','Clear, considered design for digital products and websites.']].map(([title,desc])=><article className="card" key={title}><div className="eyebrow">Digital solutions</div><h3>{title}</h3><p>{desc}</p><Link href="/services" className="status">View services →</Link></article>)}</div></div></section>
    <section className="section tint"><div className="container"><div className="sectionhead"><div className="eyebrow">Selected projects</div><h2>Products shaped around real needs.</h2><p>Explore RILORA’s messaging product and our healthcare technology collaboration with CureTrics.</p><PublicPartnershipCount/></div><div className="grid two"><Link href="/projects/rilora-messaging" className="card"><Image className="projectvisual" src="/brand/rilora-messaging.jpeg" alt="Official RILORA Messaging Application logo" width={1100} height={900}/><h3>RILORA Messaging Application</h3><p>RILORA’s own communication product, designed as a modern messaging experience.</p><span className="status">Product project · Details <ArrowRight size={13}/></span></Link><Link href="/projects/healthcare-management" className="card"><Image className="projectvisual" src="/brand/rilora-curetrics.jpeg" alt="Confirmed RILORA and CureTrics collaboration branding" width={1100} height={900}/><h3>Healthcare Management Application</h3><p>A healthcare technology project developed in collaboration with CureTrics.</p><span className="status">Confirmed collaboration · Details <ArrowRight size={13}/></span></Link></div><p className="status" style={{marginTop:18}}>Project status and public updates are shared when approved. No clinical validation or production deployment is claimed.</p></div></section>
    <section className="section"><div className="container"><div className="feature"><div><div className="eyebrow" style={{color:'#7f9eff'}}>Contribute with RILORA</div><h2>Be Part of RILORA. Build. Learn. Grow.</h2><p>Explore administrator-published jobs, internships and project-based contributor opportunities across technology, design, marketing and business.</p><Link href="/careers" className="btn">Explore opportunities <ArrowRight size={15}/></Link></div><Image className="featureimg" src="/brand/rilora-banner.png" alt="RILORA Connect and Belong" width={500} height={500}/></div></div></section>
  </main>
}
