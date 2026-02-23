/**
 * File Search Service - AI-enhanced workspace file search
 * Searches file names and content with keyword extraction and relevance ranking
 */

import { join, relative, extname, basename } from 'path'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'

export interface FileSearchResult {
  filePath: string
  relativePath: string
  fileName: string
  matchCount: number
  snippets: Array<{ line: number; content: string }>
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', '__pycache__', '.cache', 'coverage'])
const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.css', '.scss', '.html', '.json', '.yaml', '.yml', '.md', '.txt', '.sh', '.toml', '.env'])
const MAX_FILE_SIZE = 500 * 1024  // 500KB

export function searchFiles(query: string, workDir: string, maxResults = 30): FileSearchResult[] {
  if (!query.trim() || !existsSync(workDir)) return []

  // Extract keywords from natural language query
  const keywords = query.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(k => k.length > 1)

  if (keywords.length === 0) return []

  const results: FileSearchResult[] = []
  scanDir(workDir, workDir, keywords, results, maxResults * 2)

  return results
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, maxResults)
}

function scanDir(dir: string, workDir: string, keywords: string[], results: FileSearchResult[], limit: number): void {
  if (results.length >= limit) return
  try {
    for (const entry of readdirSync(dir)) {
      if (results.length >= limit) break
      if (SKIP_DIRS.has(entry) || entry.startsWith('.')) continue
      const fullPath = join(dir, entry)
      try {
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          scanDir(fullPath, workDir, keywords, results, limit)
        } else if (stat.isFile() && stat.size < MAX_FILE_SIZE && CODE_EXTS.has(extname(entry).toLowerCase())) {
          const result = searchInFile(fullPath, workDir, keywords)
          if (result) results.push(result)
        }
      } catch {}
    }
  } catch {}
}

function searchInFile(filePath: string, workDir: string, keywords: string[]): FileSearchResult | null {
  try {
    const fileName = basename(filePath).toLowerCase()
    // Filename matches weighted 3x
    let matchCount = keywords.filter(k => fileName.includes(k)).length * 3

    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    const snippets: Array<{ line: number; content: string }> = []

    for (let i = 0; i < lines.length; i++) {
      const lower = lines[i].toLowerCase()
      const lineMatches = keywords.filter(k => lower.includes(k)).length
      if (lineMatches > 0) {
        matchCount += lineMatches
        if (snippets.length < 3) {
          snippets.push({ line: i + 1, content: lines[i].trim().substring(0, 120) })
        }
      }
    }

    if (matchCount === 0) return null

    return {
      filePath,
      relativePath: relative(workDir, filePath).replace(/\\/g, '/'),
      fileName: basename(filePath),
      matchCount,
      snippets
    }
  } catch {
    return null
  }
}
