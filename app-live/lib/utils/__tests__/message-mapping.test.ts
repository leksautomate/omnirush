import { describe, expect, it } from 'vitest'

import {
  mapDBPartToUIMessagePart,
  mapUIMessagePartsToDBParts
} from '../message-mapping'

// Regression test for a real production bug: fully-typed `tool-<name>` parts for tools
// with no dedicated DB columns (every video-pipeline tool — composeRender,
// generateThumbnail, writeScript, cutBeats, sourceFootage, generateVoiceover,
// generateImage, generateAvatar, generateMusic, learnFromVideo)
// fell through to raw data_* storage, leaving tool_tool_call_id/tool_state NULL. That
// violates the `tool_fields_required` check constraint on the parts table, so the whole
// message's insert failed silently and the assistant's reply vanished on reload.
describe('mapUIMessagePartsToDBParts — unmapped tool parts', () => {
  it('always sets tool_toolCallId and tool_state for tool-<name> parts (constraint safety)', () => {
    const part = {
      type: 'tool-composeRender',
      toolCallId: 'call_1',
      state: 'output-available',
      input: { shots: [] },
      output: { studioPath: '/studio/abc' }
    }

    const [row] = mapUIMessagePartsToDBParts([part], 'msg_1')

    expect(row.type.startsWith('tool-')).toBe(true)
    expect(row.tool_toolCallId).toBeTruthy()
    expect(row.tool_state).toBeTruthy()
  })

  it('round-trips an output-available part for an unmapped tool', () => {
    const original = {
      type: 'tool-composeRender',
      toolCallId: 'call_1',
      state: 'output-available' as const,
      input: { shots: [{ kind: 'photo' }] },
      output: { studioPath: '/studio/abc', shots: 1 }
    }

    const [row] = mapUIMessagePartsToDBParts([original], 'msg_1')
    const rebuilt = mapDBPartToUIMessagePart(row as any) as any

    expect(rebuilt.type).toBe('tool-composeRender')
    expect(rebuilt.state).toBe('output-available')
    expect(rebuilt.toolCallId).toBe('call_1')
    expect(rebuilt.input).toEqual(original.input)
    expect(rebuilt.output).toEqual(original.output)
  })

  it('round-trips an output-error part for an unmapped tool', () => {
    const original = {
      type: 'tool-generateThumbnail',
      toolCallId: 'call_2',
      state: 'output-error' as const,
      input: { concept: 'a thumbnail' },
      errorText: 'image generation failed'
    }

    const [row] = mapUIMessagePartsToDBParts([original], 'msg_1')
    const rebuilt = mapDBPartToUIMessagePart(row as any) as any

    expect(rebuilt.type).toBe('tool-generateThumbnail')
    expect(rebuilt.state).toBe('output-error')
    expect(rebuilt.errorText).toBe('image generation failed')
    expect(rebuilt.output).toBeUndefined()
  })

  it('round-trips an input-available part for an unmapped tool', () => {
    const original = {
      type: 'tool-cutBeats',
      toolCallId: 'call_3',
      state: 'input-available' as const,
      input: { script: 'Once upon a time' }
    }

    const [row] = mapUIMessagePartsToDBParts([original], 'msg_1')
    const rebuilt = mapDBPartToUIMessagePart(row as any) as any

    expect(rebuilt.type).toBe('tool-cutBeats')
    expect(rebuilt.state).toBe('input-available')
    expect(rebuilt.input).toEqual(original.input)
  })

  it('does not disturb known fixed-column tools (tool-search)', () => {
    const original = {
      type: 'tool-search',
      toolCallId: 'call_4',
      state: 'output-available' as const,
      input: { query: 'test' },
      output: { results: [] }
    }

    const [row] = mapUIMessagePartsToDBParts([original], 'msg_1')
    expect(row.type).toBe('tool-search')
    expect(row.tool_dynamic_type).toBeUndefined()

    const rebuilt = mapDBPartToUIMessagePart(row as any) as any
    expect(rebuilt.type).toBe('tool-search')
    expect(rebuilt.output).toEqual(original.output)
  })

  it('still reconstructs a real dynamic-tool (MCP) part as dynamic-tool, not a named type', () => {
    const original = {
      type: 'dynamic-tool',
      toolCallId: 'call_5',
      toolName: 'mcp__someServer__doThing',
      state: 'output-available' as const,
      input: { a: 1 },
      output: { b: 2 }
    }

    const [row] = mapUIMessagePartsToDBParts([original as any], 'msg_1')
    expect(row.tool_dynamic_type).toBe('mcp')

    const rebuilt = mapDBPartToUIMessagePart(row as any) as any
    expect(rebuilt.type).toBe('dynamic-tool')
    expect(rebuilt.toolName).toBe('mcp__someServer__doThing')
  })
})
