/**
 * Request Converter: Anthropic -> OpenAI Chat Completions
 */

import type { AnthropicRequest, OpenAIChatRequest } from '../../types'
import { convertAnthropicMessagesToOpenAIChat } from '../messages'
import {
  convertAnthropicToolsToOpenAIChat,
  convertAnthropicToolChoiceToOpenAIChat,
  convertAnthropicThinkingToOpenAIReasoning
} from '../tools'

export interface ConversionResult {
  request: OpenAIChatRequest
  hasImages: boolean
  hasTools: boolean
}

/**
 * Convert Anthropic request to OpenAI Chat Completions request
 */
export function convertAnthropicToOpenAIChat(anthropicRequest: AnthropicRequest): ConversionResult {
  // Convert messages
  const { messages, hasImages } = convertAnthropicMessagesToOpenAIChat(
    anthropicRequest.messages,
    anthropicRequest.system
  )

  // Convert tools - just filter invalid ones, don't reject all
  const tools = convertAnthropicToolsToOpenAIChat(anthropicRequest.tools)

  // Build OpenAI request with core generation parameters.
  const openaiRequest: OpenAIChatRequest = {
    model: anthropicRequest.model,
    messages,
    max_tokens: anthropicRequest.max_tokens,
    stream: anthropicRequest.stream
  }

  // Add tools if present
  if (tools && tools.length > 0) {
    openaiRequest.tools = tools
    openaiRequest.tool_choice = convertAnthropicToolChoiceToOpenAIChat(anthropicRequest.tool_choice)
  }

  // Convert thinking -> reasoning
  if (anthropicRequest.thinking) {
    openaiRequest.reasoning = convertAnthropicThinkingToOpenAIReasoning(anthropicRequest.thinking)
  }

  return {
    request: openaiRequest,
    hasImages,
    hasTools: !!tools && tools.length > 0
  }
}

/**
 * Simplified conversion that returns just the request
 * (for backward compatibility)
 */
export function convertRequest(anthropicRequest: AnthropicRequest): OpenAIChatRequest {
  return convertAnthropicToOpenAIChat(anthropicRequest).request
}
