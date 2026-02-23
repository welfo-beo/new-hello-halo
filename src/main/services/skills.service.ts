import { join } from 'path'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { getHaloDir } from './config.service'

export interface SkillDef {
  name: string
  description?: string
  content: string
  source: 'global' | 'space'
  filePath: string
}

function parseSkillFile(filePath: string, source: 'global' | 'space'): SkillDef | null {
  try {
    const raw = readFileSync(filePath, 'utf-8')
    const name = filePath.split(/[\\/]/).pop()?.replace(/\.md$/, '') || 'unknown'
    let description = ''
    let content = raw

    // Parse YAML frontmatter
    if (raw.startsWith('---')) {
      const end = raw.indexOf('---', 3)
      if (end > 0) {
        const fm = raw.slice(3, end)
        const descMatch = fm.match(/^description:\s*(.+)$/m)
        if (descMatch) description = descMatch[1].trim()
        content = raw.slice(end + 3).trim()
      }
    }

    return { name, description, content, source, filePath }
  } catch {
    return null
  }
}

function scanDir(dir: string, source: 'global' | 'space'): SkillDef[] {
  if (!existsSync(dir)) return []
  try {
    return readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .map(f => parseSkillFile(join(dir, f), source))
      .filter((s): s is SkillDef => s !== null)
  } catch {
    return []
  }
}

export function listSkills(spaceDir?: string): SkillDef[] {
  const globalDir = join(getHaloDir(), 'skills')
  const skills = scanDir(globalDir, 'global')

  if (spaceDir) {
    const spaceSkillsDir = join(spaceDir, '.halo', 'skills')
    skills.push(...scanDir(spaceSkillsDir, 'space'))
  }

  return skills
}
