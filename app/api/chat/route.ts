import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { getPublicWebsiteKnowledge } from '@/lib/public-knowledge';

export const runtime = 'nodejs';
const notFound = "I couldn't find verified information about this on the RILORA website. Please contact the RILORA team through the Support section.";
const requests = new Map<string, { startedAt: number; count: number }>();
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT = 30;
const XAI_BASE_URL = 'https://api.x.ai/v1';

export async function GET() {
  return NextResponse.json({ configured: Boolean(process.env.XAI_API_KEY?.trim()), assistant: 'RiloraGPT' });
}

export async function POST(request: Request) {
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) return NextResponse.json({ configured: false, error: 'RiloraGPT is unavailable right now. Please contact the RILORA team through Support or email rilora.official@gmail.com.' }, { status: 503 });
  try {
    const body = await request.json();
    if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 8) return NextResponse.json({ error: 'Invalid conversation.' }, { status: 400 });
    const forwarded = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim();
    const clientKey = createHash('sha256').update(forwarded || 'unknown-client').digest('hex');
    const now = Date.now();
    const record = requests.get(clientKey);
    if (record && now - record.startedAt < RATE_WINDOW_MS && record.count >= RATE_LIMIT) {
      return NextResponse.json({ error: 'RiloraGPT is receiving many requests. Please try again in about an hour.' }, { status: 429 });
    }
    if (!record || now - record.startedAt >= RATE_WINDOW_MS) requests.set(clientKey, { startedAt: now, count: 1 });
    else requests.set(clientKey, { ...record, count: record.count + 1 });
    if (requests.size > 10_000) {
      for (const [hash, entry] of requests) if (now - entry.startedAt >= RATE_WINDOW_MS) requests.delete(hash);
      while (requests.size > 10_000) requests.delete(requests.keys().next().value!);
    }
    const messages = body.messages.map((message: { role?: unknown; content?: unknown }) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: typeof message.content === 'string' ? message.content.slice(0, 1000) : '',
    })).filter((message: { content: string }) => message.content);
    const knowledge = await getPublicWebsiteKnowledge();
    const system = `You are Chat with RiloraGPT, the public assistant for RILORA's website. Answer natural-language questions helpfully and concisely, using only the public verified website knowledge below. This knowledge is public; do not claim access to private systems. Never reveal or infer credentials, resumes, candidate details, internal notes, private enquiries, unpublished or closed jobs, or confidential company information. Never invent a service, job, eligibility rule, salary, policy, achievement, certificate, or partnership. Distinguish paid employment, internship, and project-based contribution exactly as the public listing does. Only describe a role as open if it is included in currentOpportunities. For applications, direct users to Careers, open a published listing, and select Apply Now. For support or partnership contact, direct them to the Support page or rilora.official@gmail.com. If this information does not answer the question, reply exactly: "${notFound}".\n\nCurrent public website knowledge (JSON):\n${JSON.stringify(knowledge)}`;
    const response = await fetch(`${XAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.XAI_MODEL?.trim() || 'grok-4.7', messages: [{ role: 'system', content: system }, ...messages] }),
      // Grok 4.7 is a reasoning model; xAI examples allow substantially longer requests.
      signal: AbortSignal.timeout(120000),
    });
    if (response.status === 401 || response.status === 403) return NextResponse.json({ configured: false, error: 'RiloraGPT is temporarily unavailable because its xAI credentials were not accepted. Please contact the RILORA team through Support.' }, { status: 503 });
    if (!response.ok) {
      let providerCode = 'unknown';
      try {
        const providerError = await response.json();
        const code = providerError?.error?.code || providerError?.error?.type;
        if (typeof code === 'string') providerCode = code.slice(0, 80);
      } catch { /* Do not log or return provider response bodies. */ }
      console.error('xAI chatbot request failed:', { status: response.status, code: providerCode });
      if (response.status === 429) return NextResponse.json({ configured: true, error: 'RiloraGPT is temporarily busy. Please wait a moment and try again.' }, { status: 429 });
      if (response.status === 400 || response.status === 404) return NextResponse.json({ configured: true, error: 'RiloraGPT could not use the configured xAI model. Check XAI_MODEL in .env.local, then restart the server.' }, { status: 503 });
      return NextResponse.json({ configured: true, error: 'RiloraGPT could not answer right now. Please try again or contact the RILORA team through Support.' }, { status: 503 });
    }
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;
    return NextResponse.json({ configured: true, reply: typeof reply === 'string' && reply.trim() ? reply.slice(0, 3000) : notFound });
  } catch (error) {
    if (error instanceof Error) console.error('xAI chatbot connection failed:', error.name);
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json({ configured: true, error: 'Grok is taking longer than expected. Please try again shortly.' }, { status: 504 });
    }
    return NextResponse.json({ configured: true, error: 'RiloraGPT could not connect right now. Please try again or contact the RILORA team through Support.' }, { status: 503 });
  }
}
