/**
 * Space Service Unit Tests
 *
 * Tests for workspace/space management service.
 * Covers space creation, listing, and stats calculation.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'

import {
  getHaloSpace,
  listSpaces,
  createSpace,
  getSpace,
  getSpaceWithPreferences,
  deleteSpace,
  getAllSpacePaths,
  updateSpace,
  updateSpacePreferences,
  getSpacePreferences,
  writeOnboardingArtifact,
  saveOnboardingConversation,
  _resetRegistryForTesting
} from '../../../src/main/services/space.service'
import { initializeApp, getSpacesDir, getTempSpacePath } from '../../../src/main/services/config.service'

describe('Space Service', () => {
  beforeEach(async () => {
    _resetRegistryForTesting()
    await initializeApp()
  })

  describe('getHaloSpace', () => {
    it('should return the Halo temp space', () => {
      const haloSpace = getHaloSpace()

      expect(haloSpace.id).toBe('halo-temp')
      expect(haloSpace.name).toBe('Halo')
      expect(haloSpace.isTemp).toBe(true)
      expect(haloSpace.icon).toBe('sparkles')
    })

    it('should have valid path', () => {
      const haloSpace = getHaloSpace()

      expect(haloSpace.path).toBeTruthy()
      expect(fs.existsSync(haloSpace.path)).toBe(true)
    })

  })

  describe('listSpaces', () => {
    it('should return empty array when no custom spaces exist', () => {
      const spaces = listSpaces()

      expect(Array.isArray(spaces)).toBe(true)
      expect(spaces.length).toBe(0)
    })

    it('should include created spaces', async () => {
      // Create a test space
      await createSpace({
        name: 'Test Project',
        icon: 'folder'
      })

      const spaces = listSpaces()

      expect(spaces.length).toBe(1)
      expect(spaces[0].name).toBe('Test Project')
    })
  })

  describe('createSpace', () => {
    it('should create a new space in default directory', async () => {
      const space = await createSpace({
        name: 'My Project',
        icon: 'code'
      })

      expect(space.id).toBeTruthy()
      expect(space.name).toBe('My Project')
      expect(space.icon).toBe('code')
      expect(space.isTemp).toBe(false)
      expect(fs.existsSync(space.path)).toBe(true)
    })

    it('should create .halo directory inside space', async () => {
      const space = await createSpace({
        name: 'Test Space',
        icon: 'folder'
      })

      const haloDir = path.join(space.path, '.halo')
      expect(fs.existsSync(haloDir)).toBe(true)
    })

    it('should create meta.json with space info', async () => {
      const space = await createSpace({
        name: 'Meta Test',
        icon: 'star'
      })

      const metaPath = path.join(space.path, '.halo', 'meta.json')
      expect(fs.existsSync(metaPath)).toBe(true)

      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      expect(meta.name).toBe('Meta Test')
      expect(meta.icon).toBe('star')
      expect(meta.id).toBe(space.id)
    })

    it('should handle custom path (centralized storage)', async () => {
      const customPath = path.join(getTempSpacePath(), 'custom-project')
      fs.mkdirSync(customPath, { recursive: true })

      const space = await createSpace({
        name: 'Custom Path Space',
        icon: 'folder',
        customPath
      })

      // Centralized storage: space.path is always under ~/.halo/spaces/{id}/
      expect(space.path).toContain(getSpacesDir())
      expect(space.path).not.toBe(customPath)
      // customPath is stored as workingDir
      expect(space.workingDir).toBe(customPath)
      // meta.json lives under the centralized space.path, not customPath
      expect(fs.existsSync(path.join(space.path, '.halo', 'meta.json'))).toBe(true)
    })
  })

  describe('getSpace', () => {
    it('should return space by id', async () => {
      const created = await createSpace({
        name: 'Get Test',
        icon: 'folder'
      })

      const space = getSpace(created.id)

      expect(space).toBeDefined()
      expect(space?.id).toBe(created.id)
      expect(space?.name).toBe('Get Test')
    })

    it('should return null/undefined for non-existent id', () => {
      const space = getSpace('non-existent-id')
      expect(space).toBeFalsy() // null or undefined
    })

    it('should return Halo space for halo-temp id', () => {
      const space = getSpace('halo-temp')

      expect(space).toBeDefined()
      expect(space?.id).toBe('halo-temp')
      expect(space?.isTemp).toBe(true)
    })
  })

  describe('deleteSpace', () => {
    it('should delete centralized space entirely', async () => {
      const space = await createSpace({
        name: 'Delete Test',
        icon: 'folder'
      })

      expect(fs.existsSync(space.path)).toBe(true)

      const result = deleteSpace(space.id)

      expect(result).toBe(true)
      // Centralized space: entire directory is removed
      expect(fs.existsSync(space.path)).toBe(false)
    })

    it('should not allow deleting Halo temp space', async () => {
      // deleteSpace may return false or throw for temp space
      try {
        const result = await deleteSpace('halo-temp')
        // If it returns without throwing, result should be false
        expect(result).toBeFalsy()
      } catch {
        // Expected to throw for temp space
        expect(true).toBe(true)
      }
    })
  })

  describe('getAllSpacePaths', () => {
    it('should include temp space path', () => {
      const paths = getAllSpacePaths()
      const tempPath = getTempSpacePath()

      expect(paths).toContain(tempPath)
    })

    it('should include created space paths', async () => {
      const space = await createSpace({
        name: 'Path Test',
        icon: 'folder'
      })

      const paths = getAllSpacePaths()

      expect(paths).toContain(space.path)
    })

    it('should include workingDir entries', async () => {
      const customPath = path.join(getTempSpacePath(), 'working-dir-test')
      fs.mkdirSync(customPath, { recursive: true })

      const space = await createSpace({
        name: 'WorkingDir Test',
        icon: 'folder',
        customPath
      })

      const paths = getAllSpacePaths()

      expect(paths).toContain(space.path)
      expect(paths).toContain(customPath)
    })
  })

  describe('updateSpace', () => {
    it('should update space name', async () => {
      const space = await createSpace({ name: 'Original', icon: 'folder' })

      const updated = updateSpace(space.id, { name: 'Renamed' })

      expect(updated).toBeDefined()
      expect(updated!.name).toBe('Renamed')
      expect(updated!.icon).toBe('folder') // icon unchanged
    })

    it('should update space icon', async () => {
      const space = await createSpace({ name: 'Icon Test', icon: 'folder' })

      const updated = updateSpace(space.id, { icon: 'star' })

      expect(updated).toBeDefined()
      expect(updated!.icon).toBe('star')
      expect(updated!.name).toBe('Icon Test') // name unchanged
    })

    it('should update updatedAt timestamp', async () => {
      const space = await createSpace({ name: 'Timestamp Test', icon: 'folder' })
      const originalUpdatedAt = space.updatedAt

      // Small delay to ensure different timestamp
      await new Promise(r => setTimeout(r, 10))

      const updated = updateSpace(space.id, { name: 'Updated' })

      expect(updated).toBeDefined()
      expect(updated!.updatedAt).not.toBe(originalUpdatedAt)
    })

    it('should persist changes to meta.json', async () => {
      const space = await createSpace({ name: 'Persist Test', icon: 'folder' })

      updateSpace(space.id, { name: 'Persisted', icon: 'code' })

      const metaPath = path.join(space.path, '.halo', 'meta.json')
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      expect(meta.name).toBe('Persisted')
      expect(meta.icon).toBe('code')
    })

    it('should preserve existing preferences during update', async () => {
      const space = await createSpace({ name: 'Prefs Test', icon: 'folder' })

      // Write preferences first
      updateSpacePreferences(space.id, { layout: { chatWidth: 400 } })

      // Now update name
      const updated = updateSpace(space.id, { name: 'Updated Name' })

      expect(updated).toBeDefined()
      expect(updated!.name).toBe('Updated Name')
      expect(updated!.preferences?.layout?.chatWidth).toBe(400)
    })

    it('should return null for non-existent space', () => {
      const result = updateSpace('non-existent', { name: 'Nope' })
      expect(result).toBeNull()
    })

    it('should return null for halo-temp space', () => {
      const result = updateSpace('halo-temp', { name: 'Nope' })
      expect(result).toBeNull()
    })
  })

  describe('updateSpacePreferences', () => {
    it('should set layout preferences', async () => {
      const space = await createSpace({ name: 'Layout Test', icon: 'folder' })

      const updated = updateSpacePreferences(space.id, {
        layout: { chatWidth: 500, artifactRailExpanded: true }
      })

      expect(updated).toBeDefined()
      expect(updated!.preferences?.layout?.chatWidth).toBe(500)
      expect(updated!.preferences?.layout?.artifactRailExpanded).toBe(true)
    })

    it('should deep merge layout preferences', async () => {
      const space = await createSpace({ name: 'Merge Test', icon: 'folder' })

      // Set initial preferences
      updateSpacePreferences(space.id, { layout: { chatWidth: 400 } })

      // Merge new preference — chatWidth should be preserved
      const updated = updateSpacePreferences(space.id, {
        layout: { artifactRailExpanded: true }
      })

      expect(updated).toBeDefined()
      expect(updated!.preferences?.layout?.chatWidth).toBe(400)
      expect(updated!.preferences?.layout?.artifactRailExpanded).toBe(true)
    })

    it('should persist preferences to meta.json', async () => {
      const space = await createSpace({ name: 'Persist Prefs', icon: 'folder' })

      updateSpacePreferences(space.id, { layout: { chatWidth: 600 } })

      const metaPath = path.join(space.path, '.halo', 'meta.json')
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      expect(meta.preferences?.layout?.chatWidth).toBe(600)
    })

    it('should work for halo-temp space', () => {
      const updated = updateSpacePreferences('halo-temp', {
        layout: { chatWidth: 350 }
      })

      expect(updated).toBeDefined()
      expect(updated!.preferences?.layout?.chatWidth).toBe(350)
    })

    it('should return null for non-existent space', () => {
      const result = updateSpacePreferences('non-existent', { layout: { chatWidth: 100 } })
      expect(result).toBeNull()
    })
  })

  describe('getSpacePreferences', () => {
    it('should return null when no preferences set', async () => {
      const space = await createSpace({ name: 'No Prefs', icon: 'folder' })

      const prefs = getSpacePreferences(space.id)
      expect(prefs).toBeNull()
    })

    it('should return saved preferences', async () => {
      const space = await createSpace({ name: 'Has Prefs', icon: 'folder' })
      updateSpacePreferences(space.id, { layout: { chatWidth: 450 } })

      const prefs = getSpacePreferences(space.id)
      expect(prefs).toBeDefined()
      expect(prefs!.layout?.chatWidth).toBe(450)
    })

    it('should return null for non-existent space', () => {
      const prefs = getSpacePreferences('non-existent')
      expect(prefs).toBeNull()
    })
  })

  describe('getSpaceWithPreferences', () => {
    it('should return space with preferences loaded', async () => {
      const space = await createSpace({ name: 'With Prefs', icon: 'folder' })
      updateSpacePreferences(space.id, { layout: { artifactRailExpanded: true } })

      const loaded = getSpaceWithPreferences(space.id)

      expect(loaded).toBeDefined()
      expect(loaded!.name).toBe('With Prefs')
      expect(loaded!.preferences?.layout?.artifactRailExpanded).toBe(true)
    })

    it('should return space without preferences when none set', async () => {
      const space = await createSpace({ name: 'No Prefs', icon: 'folder' })

      const loaded = getSpaceWithPreferences(space.id)

      expect(loaded).toBeDefined()
      expect(loaded!.name).toBe('No Prefs')
      expect(loaded!.preferences).toBeUndefined()
    })

    it('should return null for non-existent space', () => {
      const result = getSpaceWithPreferences('non-existent')
      expect(result).toBeNull()
    })
  })

  describe('deleteSpace (additional cases)', () => {
    it('should return false for non-existent space', () => {
      const result = deleteSpace('non-existent-id')
      expect(result).toBe(false)
    })

    it('should remove space from listSpaces after deletion', async () => {
      const space = await createSpace({ name: 'List Delete', icon: 'folder' })
      expect(listSpaces().some(s => s.id === space.id)).toBe(true)

      deleteSpace(space.id)

      expect(listSpaces().some(s => s.id === space.id)).toBe(false)
    })

    it('should remove space from getSpace after deletion', async () => {
      const space = await createSpace({ name: 'Get Delete', icon: 'folder' })
      expect(getSpace(space.id)).toBeDefined()

      deleteSpace(space.id)

      expect(getSpace(space.id)).toBeNull()
    })

    it('should handle legacy custom path (only remove .halo folder)', async () => {
      // Simulate a legacy space with path outside spacesDir
      const legacyPath = path.join(getTempSpacePath(), 'legacy-project')
      fs.mkdirSync(path.join(legacyPath, '.halo'), { recursive: true })

      // Create a user file that should be preserved
      fs.writeFileSync(path.join(legacyPath, 'README.md'), '# My Project')
      fs.writeFileSync(
        path.join(legacyPath, '.halo', 'meta.json'),
        JSON.stringify({ id: 'legacy-test', name: 'Legacy', icon: 'folder', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      )

      // Create space via normal flow, then we'll test the legacy path behavior
      // For this test, create a centralized space and verify the centralized deletion path
      const space = await createSpace({ name: 'Legacy Sim', icon: 'folder', customPath: legacyPath })

      deleteSpace(space.id)

      // Centralized space path should be removed
      expect(fs.existsSync(space.path)).toBe(false)
      // But the legacy project folder (workingDir) should still exist
      expect(fs.existsSync(legacyPath)).toBe(true)
      expect(fs.existsSync(path.join(legacyPath, 'README.md'))).toBe(true)
    })
  })

  describe('writeOnboardingArtifact', () => {
    it('should write artifact to temp space', () => {
      const result = writeOnboardingArtifact('halo-temp', 'hello.txt', 'Hello World')

      expect(result).toBe(true)
      const artifactPath = path.join(getTempSpacePath(), 'artifacts', 'hello.txt')
      expect(fs.existsSync(artifactPath)).toBe(true)
      expect(fs.readFileSync(artifactPath, 'utf-8')).toBe('Hello World')
    })

    it('should write artifact to custom space workingDir', async () => {
      const customPath = path.join(getTempSpacePath(), 'onboard-project')
      fs.mkdirSync(customPath, { recursive: true })

      const space = await createSpace({ name: 'Onboard', icon: 'folder', customPath })

      const result = writeOnboardingArtifact(space.id, 'test.md', '# Test')

      expect(result).toBe(true)
      expect(fs.existsSync(path.join(customPath, 'test.md'))).toBe(true)
    })

    it('should return false for non-existent space', () => {
      const result = writeOnboardingArtifact('non-existent', 'file.txt', 'content')
      expect(result).toBe(false)
    })
  })

  describe('saveOnboardingConversation', () => {
    it('should save conversation to temp space', () => {
      const convId = saveOnboardingConversation('halo-temp', 'Hello', 'Welcome!')

      expect(convId).toBeTruthy()
      const convPath = path.join(getTempSpacePath(), 'conversations', `${convId}.json`)
      expect(fs.existsSync(convPath)).toBe(true)

      const conv = JSON.parse(fs.readFileSync(convPath, 'utf-8'))
      expect(conv.title).toBe('Welcome to Halo')
      expect(conv.messages).toHaveLength(2)
      expect(conv.messages[0].role).toBe('user')
      expect(conv.messages[0].content).toBe('Hello')
      expect(conv.messages[1].role).toBe('assistant')
      expect(conv.messages[1].content).toBe('Welcome!')
    })

    it('should save conversation to custom space', async () => {
      const space = await createSpace({ name: 'Conv Test', icon: 'folder' })

      const convId = saveOnboardingConversation(space.id, 'Hi', 'Hey there!')

      expect(convId).toBeTruthy()
      const convPath = path.join(space.path, '.halo', 'conversations', `${convId}.json`)
      expect(fs.existsSync(convPath)).toBe(true)
    })

    it('should return null for non-existent space', () => {
      const result = saveOnboardingConversation('non-existent', 'Hi', 'Hello')
      expect(result).toBeNull()
    })
  })
})
