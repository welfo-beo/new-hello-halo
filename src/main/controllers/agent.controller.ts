/**		      	    				  	  	  	 		 		       	 	 	         	 	    					 
 * Agent Controller - Unified business logic for agent operations
 * Used by both IPC handlers and HTTP routes
 */

import type { BrowserWindow } from 'electron'
import {
  sendMessage as agentSendMessage,
  stopGeneration as agentStopGeneration,
  isGenerating,
  getActiveSessions,
  getSessionState as agentGetSessionState,
  testMcpConnections as agentTestMcpConnections,
  resolveQuestion
} from '../services/agent'
import {
  getOmcAgentList,
  getOmcAgents as getOmcAgentDefinitions,
  getOmcSystemPrompt as getOmcSystemPromptText
} from '../services/omc.service'

// Image attachment type for multi-modal messages
interface ImageAttachment {
  id: string
  type: 'image'
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  data: string  // Base64 encoded
  name?: string
  size?: number
}

export interface SendMessageRequest {
  spaceId: string
  conversationId: string
  message: string
  resumeSessionId?: string
  images?: ImageAttachment[]  // Optional images for multi-modal messages
  thinkingMode?: 'disabled' | 'enabled' | 'adaptive'
  thinkingBudget?: number
  effort?: 'max' | 'high' | 'medium' | 'low'
  thinkingEnabled?: boolean   // Enable extended thinking mode
  aiBrowserEnabled?: boolean  // Enable AI Browser tools
  subagents?: Array<{
    name: string
    description: string
    prompt: string
    tools?: string[]
    model?: 'sonnet' | 'opus' | 'haiku' | 'inherit'
    skills?: string[]
  }>
  orchestration?: {
    provider: 'omc'
    mode: 'session'
    workflowMode: 'autopilot' | 'ralph' | 'custom'
    selectedAgents: string[]
  }
  canvasContext?: {
    isOpen: boolean
    tabCount: number
    activeTab: {
      type: string
      title: string
      url?: string
      path?: string
    } | null
    tabs: Array<{
      type: string
      title: string
      url?: string
      path?: string
      isActive: boolean
    }>
  }
}

export interface ControllerResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Send a message to the agent
 */
export async function sendMessage(
  mainWindow: BrowserWindow | null,
  request: SendMessageRequest
): Promise<ControllerResponse> {
  try {
    await agentSendMessage(mainWindow, request)
    return { success: true }
  } catch (error: unknown) {
    const err = error as Error
    return { success: false, error: err.message }
  }
}

/**
 * Stop generation for a specific conversation or all
 */
export function stopGeneration(conversationId?: string): ControllerResponse {
  try {
    agentStopGeneration(conversationId)
    return { success: true }
  } catch (error: unknown) {
    const err = error as Error
    return { success: false, error: err.message }
  }
}

/**
 * Approve tool execution - no-op (all permissions auto-allowed)
 */
export function approveTool(_conversationId: string): ControllerResponse {
  return { success: true }
}

/**
 * Reject tool execution - no-op (all permissions auto-allowed)
 */
export function rejectTool(_conversationId: string): ControllerResponse {
  return { success: true }
}

/**
 * Check if a conversation is currently generating
 */
export function checkGenerating(conversationId: string): ControllerResponse<boolean> {
  try {
    return { success: true, data: isGenerating(conversationId) }
  } catch (error: unknown) {
    const err = error as Error
    return { success: false, error: err.message }
  }
}

/**
 * Get all active session conversation IDs
 */
export function listActiveSessions(): ControllerResponse<string[]> {
  try {
    return { success: true, data: getActiveSessions() }
  } catch (error: unknown) {
    const err = error as Error
    return { success: false, error: err.message }
  }
}

/**
 * Get current session state for recovery after refresh
 */
export function getSessionState(conversationId: string): ControllerResponse {
  try {
    return { success: true, data: agentGetSessionState(conversationId) }
  } catch (error: unknown) {
    const err = error as Error
    return { success: false, error: err.message }
  }
}

/**
 * Answer a pending AskUserQuestion
 */
export function answerQuestion(
  conversationId: string,
  id: string,
  answers: Record<string, string>
): ControllerResponse {
  try {
    const resolved = resolveQuestion(id, answers)
    if (!resolved) {
      return { success: false, error: `No pending question found for id: ${id}` }
    }
    return { success: true }
  } catch (error: unknown) {
    const err = error as Error
    return { success: false, error: err.message }
  }
}

/**
 * Test MCP server connections
 */
export async function testMcpConnections(mainWindow?: BrowserWindow | null): Promise<ControllerResponse> {
  try {
    const result = await agentTestMcpConnections(mainWindow)
    return result
  } catch (error: unknown) {
    const err = error as Error
    return { success: false, error: err.message }
  }
}

/**
 * Get OMC agent list for renderer display
 */
export function getOmcAgents(): ControllerResponse {
  try {
    return { success: true, data: getOmcAgentList() }
  } catch (error: unknown) {
    const err = error as Error
    return { success: false, error: err.message }
  }
}

/**
 * Get full OMC agent definitions for execution
 */
export function getOmcAgentDefs(): ControllerResponse {
  try {
    return { success: true, data: getOmcAgentDefinitions() }
  } catch (error: unknown) {
    const err = error as Error
    return { success: false, error: err.message }
  }
}

/**
 * Get OMC orchestration system prompt
 */
export function getOmcSystemPrompt(): ControllerResponse<string> {
  try {
    return { success: true, data: getOmcSystemPromptText() }
  } catch (error: unknown) {
    const err = error as Error
    return { success: false, error: err.message }
  }
}
