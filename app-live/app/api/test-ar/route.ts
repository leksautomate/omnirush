import { NextResponse } from 'next/server'
import { isProviderEnabled } from '@/lib/utils/registry'

export const dynamic = 'force-dynamic'

export async function GET() {
  const apiKey = (process.env.AGENTROUTER_API_KEY || process.env.OPENAI_COMPATIBLE_API_KEY || '').replace(/^["']|["']$/g, '').trim()
  
  const payload = {
    model: 'claude-opus-4-6',
    messages: [
      { role: 'user', content: 'Say hello in 5 words.' }
    ],
    stream: true
  }

  try {
    const res = await fetch('https://agentrouter.org/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'claude-cli/1.0.108 (external, cli)',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    })

    const bodyText = await res.text()

    return NextResponse.json({
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      apiKeyLength: apiKey.length,
      apiKeyPrefix: apiKey.slice(0, 7),
      isProviderEnabled: isProviderEnabled('agentrouter'),
      bodyText: bodyText.slice(0, 3000)
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 })
  }
}
