import { stepCountIs, ToolLoopAgent } from 'ai'

import type { ResearcherTools } from '@/lib/types/agent'
import { type Model } from '@/lib/types/models'

import { fetchTool } from '../tools/fetch'
import { createQuestionTool } from '../tools/question'
import { createSearchTool } from '../tools/search'
import { createTodoTools } from '../tools/todo'
import { createComposeRenderTool } from '../tools/video/compose-render'
import { createCutBeatsTool } from '../tools/video/cut-beats'
import { createGenerateAvatarTool } from '../tools/video/generate-avatar'
import { createGenerateImageTool } from '../tools/video/generate-image'
import { createGenerateMusicTool } from '../tools/video/generate-music'
import { createGenerateThumbnailTool } from '../tools/video/generate-thumbnail'
import { createGenerateVoiceoverTool } from '../tools/video/generate-voiceover'
import { createLearnFromVideoTool } from '../tools/video/learn-from-video'
import { createPrepareDocumentaryTool } from '../tools/video/prepare-documentary'
import { createSourceAudioTool } from '../tools/video/source-audio'
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

// 10 (this fork's inherited default from the plain search-app it started as) is nowhere
// near enough for the video pipeline: writeScript, generateVoiceover, cutBeats, then
// sourceFootage/generateImage PER SHOT, a thumbnail, and composeRender easily exceeds it
// on any real multi-shot video — observed firsthand: a 30s/6-shot video ran out of steps
// (finishReason: 'tool-calls', no error) right before composeRender ever ran. Override
// with RESEARCHER_MAX_STEPS if a deployment needs a different ceiling.
const DEFAULT_MAX_STEPS = Number(process.env.RESEARCHER_MAX_STEPS) || 40

export function createResearcher({
  model,
  searchMode = 'quick',
  parentTraceId,
  maxSteps = DEFAULT_MAX_STEPS,
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
- Maintain high discipline: plain spoken text without raw markdown symbols in narration outputs.
- Complete the sound design when appropriate: use curated music plus sourceAudio ambience and selective SFX, then pass every returned cue to composeRender.

WW1/WW2 documentary workflow:
1. Gather primary or institutional sources for the central claims.
2. Call prepareDocumentary in topic mode for an idea, or script mode when the user supplies a script. Preserve supplied narration and begin the opening scene with its date.
3. Call cutBeats with the returned documentaryId so chapters, claims, maps, evidence cards, statistics, timelines, and overlays stay connected.
4. Source final footage with sourceFootage finalRender=true. Keep every returned footageId; never substitute its thumb or source-page URL. Treat ordinary YouTube watch pages as references only; use only reusable media with retained rights metadata in the final video.
5. Use a grounded AI reconstruction only when suitable historical footage or archival imagery cannot carry the beat. Never place an AI label inside the rendered scene.
6. Use curated local music and sourceAudio for ambience/SFX, then call composeRender with the cutBeats beatsId, the same documentaryId, and the sourceFootage footageId for each resolved shot. This preserves playable clips and full-resolution images.`

    // Individual tools
    const searchTool = createSearchTool(searchMode)
    const questionTool = createQuestionTool(model)
    const todoTools = createTodoTools()
    const writeScriptTool = createWriteScriptTool(model)
    const sourceFootageTool = createSourceFootageTool()
    const cutBeatsTool = createCutBeatsTool(model)
    const composeRenderTool = createComposeRenderTool()
    const generateVoiceoverTool = createGenerateVoiceoverTool()
    const generateMusicTool = createGenerateMusicTool()
    const sourceAudioTool = createSourceAudioTool()
    const generateImageTool = createGenerateImageTool()
    const generateThumbnailTool = createGenerateThumbnailTool()
    const learnFromVideoTool = createLearnFromVideoTool()
    const prepareDocumentaryTool = createPrepareDocumentaryTool(model)
    const generateAvatarTool = createGenerateAvatarTool()

    // The tool map must always carry every key of ResearcherTools: `activeTools`
    // is only a whitelist over those keys, so gating happens there and the map's
    // shape stays stable. Advertising a name in activeTools that is missing from
    // the map produces a malformed request (HTTP 400).
    const tools: ResearcherTools = {
      search: searchTool,
      fetch: fetchTool,
      askQuestion: questionTool,
      writeScript: writeScriptTool,
      sourceFootage: sourceFootageTool,
      cutBeats: cutBeatsTool,
      generateVoiceover: generateVoiceoverTool,
      generateMusic: generateMusicTool,
      sourceAudio: sourceAudioTool,
      generateImage: generateImageTool,
      generateThumbnail: generateThumbnailTool,
      learnFromVideo: learnFromVideoTool,
      prepareDocumentary: prepareDocumentaryTool,
      generateAvatar: generateAvatarTool,
      composeRender: composeRenderTool,
      ...todoTools
    }

    // DeepSeek R1 on Groq returns 400 when tools are provided, so it runs
    // tool-free. This is specific to the R1 distill — DeepSeek's own V4 models
    // handle streaming tool calls fine and must keep the full tool set.
    const isToolSupportedModel = !model.includes('deepseek-r1')

    const activeToolsList = isToolSupportedModel
      ? (Object.keys(tools) as (keyof ResearcherTools)[])
      : []

    const agent = new ToolLoopAgent({
      model: getModel(model),
      instructions: `${systemPrompt}\nCurrent date and time: ${currentDate}`,
      tools,
      activeTools: activeToolsList,
      stopWhen: stepCountIs(maxSteps),
      // A composeRender call for a long storyboard (40+ shots, each with narration text
      // and a footage URL) can run to several thousand tokens of tool-call JSON. With no
      // explicit cap the provider's own default applies, which truncated a real call
      // mid-string ("Unterminated string in JSON") and failed the whole compose step.
      maxOutputTokens: 16000,
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
