import { smoothStream, stepCountIs, streamText, tool, ToolLoopAgent } from 'ai'

import type { ResearcherTools } from '@/lib/types/agent'
import { type Model } from '@/lib/types/models'

import { fetchTool } from '../tools/fetch'
import { createQuestionTool } from '../tools/question'
import { createSearchTool } from '../tools/search'
import { createTodoTools } from '../tools/todo'
import { createCloneVoiceTool } from '../tools/video/clone-voice'
import { createComposeRenderTool } from '../tools/video/compose-render'
import { createCutBeatsTool } from '../tools/video/cut-beats'
import { createGenerateAvatarTool } from '../tools/video/generate-avatar'
import { createGenerateImageTool } from '../tools/video/generate-image'
import { createGenerateMusicTool } from '../tools/video/generate-music'
import { createGenerateThumbnailTool } from '../tools/video/generate-thumbnail'
import { createGenerateVoiceoverTool } from '../tools/video/generate-voiceover'
import { createLearnFromVideoTool } from '../tools/video/learn-from-video'
import { createListVoicesTool } from '../tools/video/list-voices'
import { createSourceFootageTool } from '../tools/video/source-footage'
import { createWriteScriptTool } from '../tools/video/write-script'
import { SearchMode } from '../types/search'
import { getModel } from '../utils/registry'
import { isTracingEnabled } from '../utils/telemetry'

export interface CreateResearcherOptions {
  model: string
  searchMode?: SearchMode
  parentTraceId?: string
  maxSteps?: number
  modelConfig?: Model
  relatedEnabled?: boolean
}

export function createResearcher({
  model,
  searchMode = 'quick',
  parentTraceId,
  maxSteps = 10,
  modelConfig
}: CreateResearcherOptions): ToolLoopAgent<never, ResearcherTools, never> {
  try {
    const currentDate = new Date().toISOString().split('T')[0]

    const systemPrompt = `You are Kakkao — an elite, full-stack AI YouTube automation studio. You act as an expert video strategist, scriptwriter, storyboarding director, and media coordinator.

You help creators turn raw ideas into ready-to-render, highly-engaging YouTube videos.

Core Philosophy:
- Write scripts meant for spoken narration (concise, high hook retention, punchy sentences, zero fluff).
- Ground every narrative in real facts, numbers, and compelling storytelling.
- Be proactive: when the user gives an idea, draft a complete action plan or script directly.
- Maintain high discipline: plain spoken text without raw markdown symbols in narration outputs.`

    // Individual tools
    const searchTool = createSearchTool(searchMode)
    const questionTool = createQuestionTool(model)
    const todoTools = createTodoTools()
    const writeScriptTool = createWriteScriptTool(model)
    const sourceFootageTool = createSourceFootageTool()
    const cutBeatsTool = createCutBeatsTool(model)
    const composeRenderTool = createComposeRenderTool()
    const generateVoiceoverTool = createGenerateVoiceoverTool()
    const listVoicesTool = createListVoicesTool()
    const cloneVoiceTool = createCloneVoiceTool()
    const generateMusicTool = createGenerateMusicTool()
    const generateImageTool = createGenerateImageTool()
    const generateThumbnailTool = createGenerateThumbnailTool()
    const learnFromVideoTool = createLearnFromVideoTool()
    const generateAvatarTool = createGenerateAvatarTool()

    const activeToolsList = [
      'search',
      'fetch',
      'askQuestion',
      'writeScript',
      'sourceFootage',
      'cutBeats',
      'listVoices',
      'generateVoiceover',
      'cloneVoice',
      'generateMusic',
      'generateImage',
      'generateThumbnail',
      'learnFromVideo',
      'generateAvatar',
      'composeRender',
      'todoWrite'
    ] as const

    const tools = {
      search: searchTool,
      fetch: fetchTool,
      askQuestion: questionTool,
      writeScript: writeScriptTool,
      sourceFootage: sourceFootageTool,
      cutBeats: cutBeatsTool,
      listVoices: listVoicesTool,
      generateVoiceover: generateVoiceoverTool,
      cloneVoice: cloneVoiceTool,
      generateMusic: generateMusicTool,
      generateImage: generateImageTool,
      generateThumbnail: generateThumbnailTool,
      learnFromVideo: learnFromVideoTool,
      generateAvatar: generateAvatarTool,
    } as ResearcherTools

    const isAgentRouter = model.startsWith('agentrouter') || model.includes('opus')

    if (isAgentRouter) {
      return {
        stream: (options: { messages: Array<any>; abortSignal?: AbortSignal }) => {
          return streamText({
            model: getModel(model),
            system: `${systemPrompt}\nCurrent date and time: ${currentDate}`,
            messages: options.messages,
            abortSignal: options.abortSignal,
            experimental_transform: smoothStream()
          })
        }
      } as any
    }

    const agent = new ToolLoopAgent({
      model: getModel(model),
      instructions: `${systemPrompt}\nCurrent date and time: ${currentDate}`,
      tools,
      activeTools: activeToolsList as any,
      stopWhen: stepCountIs(maxSteps),
      experimental_telemetry: {
        isEnabled: isTracingEnabled(),
        functionId: 'research-agent',
        metadata: {
          modelId: model,
          agentType: 'researcher',
          searchMode,
          ...(parentTraceId && {
            langfuseTraceId: parentTraceId,
            langfuseUpdateParent: false
          })
        }
      }
    })

    return agent
  } catch (error) {
    console.error('Error in createResearcher:', error)
    throw error
  }
}

export function getResearcherTools(
  agent: ToolLoopAgent<never, ResearcherTools, never>
): ResearcherTools {
  return agent.tools
}

export const researcher = createResearcher
