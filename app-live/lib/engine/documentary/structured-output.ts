import { generateText, type LanguageModel, tool } from 'ai'
import type { z } from 'zod'

const SUBMIT_TOOL = 'submit_documentary_object'

export async function generateDocumentaryObject<T>(input: {
  model: LanguageModel
  schema: z.ZodType<T>
  system: string
  prompt: string
  maxOutputTokens?: number
  abortSignal?: AbortSignal
}): Promise<T> {
  const result = await generateText({
    model: input.model,
    system: input.system,
    prompt: input.prompt,
    maxOutputTokens: input.maxOutputTokens,
    abortSignal: input.abortSignal,
    tools: {
      [SUBMIT_TOOL]: tool({
        description: 'Submit the completed structured documentary data.',
        inputSchema: input.schema
      })
    },
    toolChoice: { type: 'tool', toolName: SUBMIT_TOOL }
  })
  const call = result.toolCalls.find(item => item.toolName === SUBMIT_TOOL)
  if (!call) {
    throw new Error('Model did not submit the required documentary object')
  }
  return input.schema.parse(call.input)
}
