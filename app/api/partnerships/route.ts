import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { hasServerSupabaseConfig } from '@/lib/public-config';
import { notify, supabase, supabaseAdmin, supabaseConfigured } from '@/lib/supabase';

export async function GET(){if(!supabaseConfigured())return NextResponse.json({data:[],partnershipCount:null,configured:false},{headers:{'Cache-Control':'no-store'}});try{const {data,error,count}=await supabase().from('partnerships').select('id,slug,name,description,logo_url,website_url,status',{count:'exact'}).eq('is_published',true).in('status',['approved','active']).order('created_at',{ascending:false});if(error)throw error;return NextResponse.json({data,partnershipCount:count??data?.length??0,configured:true},{headers:{'Cache-Control':'no-store'}});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to load partnerships.',partnershipCount:null},{status:503,headers:{'Cache-Control':'no-store'}});}}

export async function POST(request:Request){
  if(!hasServerSupabaseConfig())return NextResponse.json({error:'Partnership enquiries are not connected yet. Please try again later.'},{status:503});
  let originAllowed=false;try{const origin=request.headers.get('origin');const allowed=process.env.NEXT_PUBLIC_SITE_URL?new URL(process.env.NEXT_PUBLIC_SITE_URL).origin:new URL(request.url).origin;originAllowed=!origin||origin===allowed;}catch{}
  if(!originAllowed)return NextResponse.json({error:'This enquiry could not be verified.'},{status:403});
  try{
    const body=await request.json();if(String(body.website_url||'').trim())return NextResponse.json({ok:true});
    const clean=(value:unknown,max:number)=>typeof value==='string'?value.trim().slice(0,max):'';
    const contact=clean(body.contact_person,120).replace(/\s+/g,' '),organization=clean(body.organization_name,160).replace(/\s+/g,' '),email=clean(body.email,254).toLowerCase(),phone=clean(body.phone,40),type=clean(body.partnership_type,80),description=clean(body.description,4000);
    if(organization.length<2||contact.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['Technology collaboration','Product development','Research collaboration','Service partnership','Other'].includes(type)||description.length<20)return NextResponse.json({error:'Please provide an organization, contact person, valid email, partnership type and at least 20 characters of detail.'},{status:400});
    const admin=supabaseAdmin();const digest=createHash('sha256').update(`${process.env.VISITOR_HASH_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY}:${email}`).digest('hex');
    const {data:allowed,error:limitError}=await admin.rpc('check_career_interest_rate_limit',{p_email_hash:digest});if(limitError)throw limitError;if(!allowed)return NextResponse.json({error:'You have reached the partnership enquiry limit. Please try again in 24 hours.'},{status:429});
    const {data,error}=await admin.from('service_enquiries').insert({name:contact,organisation:organization,email,phone:phone||null,category:'partnership',subject:`Partnership enquiry: ${type}`,service_required:type,project_description:description}).select('id,enquiry_id,partnership_id').single();if(error)throw error;
    const emailSent=await notify(`New RILORA partnership enquiry ${data.partnership_id}`,`<p>A partnership enquiry is saved in the protected Admin Dashboard.</p><p>Reference: ${escapeHtml(data.partnership_id)}<br/>Organization: ${escapeHtml(organization)}<br/>Contact: ${escapeHtml(contact)} (${escapeHtml(email)})<br/>Type: ${escapeHtml(type)}<br/>Enquiry reference: ${escapeHtml(data.enquiry_id)}</p>`);
    return NextResponse.json({ok:true,partnershipId:data.partnership_id,emailSent});
  }catch(error){console.error('Partnership enquiry submission failed:',error instanceof Error?error.message:'Unknown error');return NextResponse.json({error:'Unable to save your partnership enquiry. Please try again later.'},{status:503});}
}
function escapeHtml(value:string){const entities:Record<string,string>={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};return value.replace(/[&<>"']/g,char=>entities[char]||char)}
