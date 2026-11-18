import { NextResponse } from 'next/server';
import { supabase, supabaseConfigured } from '@/lib/supabase';
export async function GET() { if(!supabaseConfigured())return NextResponse.json({data:[],configured:false});try { const {data,error}=await supabase().from('projects').select('*').eq('is_published',true).order('created_at',{ascending:false}); if(error)throw error; return NextResponse.json({data}); } catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to load projects.'},{status:503});} }
