import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../types'
import { createDefaultOpenAIProfile, DEFAULT_SETTINGS, normalizeSettings } from './apiProfiles'
import { getOutputImageLimitForSettings, normalizeParamsForSettings, MAX_FAL_OUTPUT_IMAGES, MAX_OPENAI_OUTPUT_IMAGES, DEFAULT_FAL_IMAGE_SIZE } from './paramCompatibility'

describe('parameter compatibility', () => {
  it('limits OpenAI output count to 10', () => {
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      galleryApiKey: 'test-key',
    })

    expect(getOutputImageLimitForSettings(settings)).toBe(MAX_OPENAI_OUTPUT_IMAGES)
    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, n: 12 }, settings).n).toBe(MAX_OPENAI_OUTPUT_IMAGES)
  })

  it('keeps OpenAI streaming output count so the request can disable streaming', () => {
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      galleryApiKey: 'test-key',
    })

    expect(normalizeParamsForSettings({ ...DEFAULT_PARAMS, n: 4 }, settings).n).toBe(4)
  })

  it('fal max output is 4', () => {
    // Verify the constant value directly (fal profile detection via settings is no longer supported)
    expect(MAX_FAL_OUTPUT_IMAGES).toBe(4)
  })

  it('fal default image size is 1360x1024', () => {
    // Verify the constant value directly
    expect(DEFAULT_FAL_IMAGE_SIZE).toBe('1360x1024')
  })
})
