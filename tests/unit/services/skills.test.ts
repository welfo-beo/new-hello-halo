import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { listSkills } from '../../../src/main/services/skills.service'
import { getHaloDir } from '../../../src/main/services/config.service'

describe('Skills Service', () => {
  describe('listSkills', () => {
    it('should return empty array when no skills directory exists', () => {
      const skills = listSkills()
      expect(skills).toEqual([])
    })

    it('should list global skills from .halo/skills/', () => {
      const skillsDir = path.join(getHaloDir(), 'skills')
      fs.mkdirSync(skillsDir, { recursive: true })
      fs.writeFileSync(path.join(skillsDir, 'greet.md'), 'Say hello to the user')

      const skills = listSkills()
      expect(skills).toHaveLength(1)
      expect(skills[0].name).toBe('greet')
      expect(skills[0].content).toBe('Say hello to the user')
      expect(skills[0].source).toBe('global')
    })

    it('should parse YAML frontmatter for description', () => {
      const skillsDir = path.join(getHaloDir(), 'skills')
      fs.mkdirSync(skillsDir, { recursive: true })
      fs.writeFileSync(
        path.join(skillsDir, 'test.md'),
        '---\ndescription: A test skill\n---\n\nSkill content here'
      )

      const skills = listSkills()
      expect(skills[0].description).toBe('A test skill')
      expect(skills[0].content).toBe('Skill content here')
    })

    it('should merge global and space skills', () => {
      const globalDir = path.join(getHaloDir(), 'skills')
      fs.mkdirSync(globalDir, { recursive: true })
      fs.writeFileSync(path.join(globalDir, 'global-skill.md'), 'global')

      const spaceDir = path.join(globalThis.__HALO_TEST_DIR__, 'my-space')
      const spaceSkillsDir = path.join(spaceDir, '.halo', 'skills')
      fs.mkdirSync(spaceSkillsDir, { recursive: true })
      fs.writeFileSync(path.join(spaceSkillsDir, 'space-skill.md'), 'space')

      const skills = listSkills(spaceDir)
      expect(skills).toHaveLength(2)
      expect(skills.find(s => s.source === 'global')?.name).toBe('global-skill')
      expect(skills.find(s => s.source === 'space')?.name).toBe('space-skill')
    })

    it('should ignore non-.md files', () => {
      const skillsDir = path.join(getHaloDir(), 'skills')
      fs.mkdirSync(skillsDir, { recursive: true })
      fs.writeFileSync(path.join(skillsDir, 'valid.md'), 'content')
      fs.writeFileSync(path.join(skillsDir, 'ignore.txt'), 'not a skill')
      fs.writeFileSync(path.join(skillsDir, 'ignore.json'), '{}')

      const skills = listSkills()
      expect(skills).toHaveLength(1)
      expect(skills[0].name).toBe('valid')
    })
  })
})
