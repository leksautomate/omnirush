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

  // Random residential-like IP
  const fakeIp = '104.28.194.22'

  const variations: Array<{ name: string; headers: Record<string, string> }> = [
    {
      name: 'x_forwarded_for',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Forwarded-For': fakeIp,
        'X-Real-IP': fakeIp,
        'Client-IP': fakeIp
      }
    },
    {
      name: 'cloudflare_headers',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'CF-Connecting-IP': fakeIp,
        'CF-Visitor': '{"scheme":"https"}',
        'X-Forwarded-Proto': 'https'
      }
    },
    {
      name: 'curl_user_agent',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'curl/7.88.1',
        'Accept': '*/*'
      }
    },
    {
      name: 'python_requests',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'python-requests/2.31.0',
        'Accept': '*/*'
      }
    }
  ]

  const results: any[] = []

  for (const v of variations) {
    try {
      const res = await fetch('https://agentrouter.org/v1/chat/completions', {
        method: 'POST',
        headers: v.headers,
        body: JSON.stringify(payload)
      })

      const contentType = res.headers.get('content-type') || ''
      const bodyText = await res.text()
      const isHtml = bodyText.includes('<html') || bodyText.includes('<meta') || contentType.includes('text/html')

      results.push({
        name: v.name,
        status: res.status,
        contentType,
        isWafBlocked: isHtml,
        sample: isHtml ? bodyText.slice(0, 150) : bodyText.slice(0, 300)
      })
    } catch (err: any) {
      results.push({ name: v.name, error: err.message })
    }
  }

  return NextResponse.json({ results })
}
