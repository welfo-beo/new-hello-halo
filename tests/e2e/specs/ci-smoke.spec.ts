/**
 * CI Smoke Tests
 *
 * Fast and stable smoke checks for CI that do not require API keys.
 */

import { test, expect } from '../fixtures/electron'

test.describe('CI Smoke', () => {
  test('application launches', async ({ electronApp }) => {
    expect(electronApp.process()).not.toBeNull()
  })

  test('main window renders root node', async ({ window }) => {
    await window.waitForSelector('#root', { timeout: 10000 })
    const root = await window.$('#root')
    expect(root).toBeTruthy()
  })

  test('shows some visible app text', async ({ window }) => {
    await window.waitForLoadState('domcontentloaded')

    const text = await window.evaluate(() => document.body.innerText || '')
    expect(text.length).toBeGreaterThan(0)
  })

  test('window dimensions are reasonable', async ({ window }) => {
    const dimensions = await window.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }))

    expect(dimensions.width).toBeGreaterThan(600)
    expect(dimensions.height).toBeGreaterThan(400)
  })
})
