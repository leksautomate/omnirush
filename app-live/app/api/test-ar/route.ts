import { NextResponse } from 'next/server'

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

  const proxies = [
    {
      name: 'direct',
      url: 'https://agentrouter.org/v1/chat/completions'
    },
    {
      name: 'corsproxy',
      url: 'https://corsproxy.io/?' + encodeURIComponent('https://agentrouter.org/v1/chat/completions')
    }
  ]

  const results: any[] = []

  for (const p of proxies) {
    try {
      const res = await fetch(p.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'claude-cli/1.0.108 (external, cli)',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(payload)
      })

      const contentType = res.headers.get('content-type') || ''
      const bodyText = await res.text()
      const isHtml = bodyText.includes('<html') || bodyText.includes('<meta') || contentType.includes('text/html')

      results.push({
        name: p.name,
        status: res.status,
        contentType,
        isWafBlocked: isHtml,
        sample: isHtml ? bodyText.slice(0, 150) : bodyText.slice(0, 300)
      })
    } catch (err: any) {
      results.push({ name: p.name, error: err.message })
    }
  }

  return NextResponse.json({ results })
}
