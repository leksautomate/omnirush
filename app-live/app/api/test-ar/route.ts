import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const apiKey = (process.env.AGENTROUTER_API_KEY || process.env.OPENAI_COMPATIBLE_API_KEY || '').replace(/^["']|["']$/g, '').trim()
  
  const payload = {
    model: 'claude-opus-4-6',
    messages: [
      { role: 'user', content: 'Say hello in 5 words.' }
    ],
    stream: true
  }

  const variations = [
    {
      name: 'browser_user_agent',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/event-stream, application/json'
      }
    },
    {
      name: 'openai_sdk_user_agent',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'OpenAI/JS 4.28.0',
        'Accept': 'text/event-stream'
      }
    },
    {
      name: 'minimal_headers',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    },
    {
      name: 'claude_cli_with_accept',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'claude-cli/1.0.108 (external, cli)',
        'anthropic-version': '2023-06-01',
        'Accept': 'text/event-stream'
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
