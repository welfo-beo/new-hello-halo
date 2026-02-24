/**
 * URL Utilities
 *
 * URL helpers for API endpoint handling and normalization.
 */

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '')
}

function isHostOnlyUrl(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/]+$/.test(value)
}

/**
 * Extract base URL (protocol + host) from endpoint URL
 */
export function extractBaseUrl(endpointUrl: string): string {
  const url = new URL(endpointUrl)
  return `${url.protocol}//${url.host}`
}

/**
 * Normalize to OpenAI Chat Completions endpoint URL.
 */
export function normalizeOpenAIChatCompletionsUrl(apiUrl: string): string {
  let normalized = trimTrailingSlashes(apiUrl)

  if (normalized.endsWith('/chat/completions')) {
    return normalized
  }

  if (normalized.endsWith('/chat')) {
    return `${normalized}/completions`
  }

  if (normalized.endsWith('/v1')) {
    return `${normalized}/chat/completions`
  }

  if (isHostOnlyUrl(normalized)) {
    return `${normalized}/v1/chat/completions`
  }

  return `${normalized}/chat/completions`
}

/**
 * Normalize to OpenAI Responses endpoint URL.
 */
export function normalizeOpenAIResponsesUrl(apiUrl: string): string {
  let normalized = trimTrailingSlashes(apiUrl)

  if (normalized.endsWith('/responses')) {
    return normalized
  }

  if (normalized.endsWith('/v1')) {
    return `${normalized}/responses`
  }

  if (isHostOnlyUrl(normalized)) {
    return `${normalized}/v1/responses`
  }

  return `${normalized}/responses`
}

/**
 * Normalize to Anthropic Messages endpoint URL.
 */
export function normalizeAnthropicMessagesUrl(apiUrl: string): string {
  const normalized = trimTrailingSlashes(apiUrl)

  if (normalized.endsWith('/v1/messages')) {
    return normalized
  }

  if (normalized.endsWith('/v1')) {
    return `${normalized}/messages`
  }

  if (isHostOnlyUrl(normalized)) {
    return `${normalized}/v1/messages`
  }

  return `${normalized}/messages`
}

/**
 * Normalize API URL based on provider type
 *
 * Ensures URLs are in the correct format expected by the router:
 * - Anthropic: base URL only (e.g., https://api.anthropic.com)
 * - OpenAI compatible: full endpoint URL (e.g., https://api.openai.com/v1/chat/completions)
 *
 * @param apiUrl - User-provided URL (may be incomplete)
 * @param provider - 'anthropic' or 'openai'
 * @returns Normalized URL ready for use
 */
export function normalizeApiUrl(apiUrl: string, provider: 'anthropic' | 'openai'): string {
  let normalized = trimTrailingSlashes(apiUrl)

  if (provider === 'anthropic') {
    // Anthropic: just trim trailing slashes
    return normalized
  }

  // OpenAI compatible: ensure URL ends with valid endpoint
  // Already has full endpoint? Return as-is
  if (normalized.endsWith('/chat/completions') || normalized.endsWith('/responses')) {
    return normalized
  }

  // Strip incomplete path suffix
  if (normalized.endsWith('/chat')) {
    normalized = normalized.slice(0, -5)
  }

  // Host-only URL defaults to OpenAI's /v1 API base.
  if (isHostOnlyUrl(normalized)) {
    normalized = `${normalized}/v1`
  }

  return `${normalized}/chat/completions`
}
