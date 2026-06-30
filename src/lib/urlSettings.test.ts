import { describe, expect, it } from 'vitest'
import {
  DEFAULT_IMAGES_MODEL,
  DEFAULT_SETTINGS,
  normalizeSettings,
} from './apiProfiles'
import { buildSettingsFromUrlParams, clearUrlSettingParams, hasUrlSettingParams } from './urlSettings'

describe('URL settings params', () => {
  it('sets gallery API key from legacy URL params', () => {
    const current = normalizeSettings(DEFAULT_SETTINGS)
    const next = normalizeSettings({
      ...current,
      ...buildSettingsFromUrlParams(current, new URLSearchParams('apiUrl=https://api.example.com/v1&apiKey=test-key')),
    })

    expect(next.galleryApiKey).toBe('test-key')
  })

  it('ignores model from URL params since gallery model is fixed', () => {
    const current = normalizeSettings(DEFAULT_SETTINGS)
    const next = normalizeSettings({
      ...current,
      ...buildSettingsFromUrlParams(current, new URLSearchParams('apiUrl=https://api.example.com/v1&apiKey=test-key&model=custom-image-model')),
    })

    expect(next.galleryApiKey).toBe('test-key')
  })

  it('clears known URL setting params without touching unrelated params', () => {
    const params = new URLSearchParams('apiUrl=https://api.example.com/v1&apiKey=test-key&model=test-model&foo=bar')

    expect(hasUrlSettingParams(params)).toBe(true)
    clearUrlSettingParams(params)

    expect(params.toString()).toBe('foo=bar')
  })

  it('imports settings with custom providers from URL params', () => {
    const importedSettings = {
      customProviders: [{
        id: 'custom-json',
        name: 'Custom JSON',
        submit: {
          path: 'images/generations',
          method: 'POST',
          contentType: 'json',
          body: { model: '$profile.model', prompt: '$prompt' },
          result: { imageUrlPaths: ['data.*.url'], b64JsonPaths: [] },
        },
      }],
      galleryApiKey: 'custom-key',
      selectedVideoModel: 'kling-v3',
    }
    const params = new URLSearchParams()
    params.set('settings', JSON.stringify(importedSettings))

    const next = normalizeSettings({
      ...DEFAULT_SETTINGS,
      ...buildSettingsFromUrlParams(DEFAULT_SETTINGS, params),
    })

    expect(next.customProviders).toHaveLength(1)
    expect(next.customProviders[0]).toMatchObject({ id: 'custom-json', name: 'Custom JSON' })
    expect(next.galleryApiKey).toBe('custom-key')
    expect(next.selectedVideoModel).toBe('kling-v3')
  })

  it('activates imported gallery API key from URL settings when current settings are customized', () => {
    const current = normalizeSettings({
      ...DEFAULT_SETTINGS,
      galleryApiKey: 'current-key',
    })
    const importedSettings = {
      customProviders: [{
        id: 'custom-json',
        name: 'Custom JSON',
        submit: {
          path: 'images/generations',
          method: 'POST',
          contentType: 'json',
          body: { model: '$profile.model', prompt: '$prompt' },
          result: { imageUrlPaths: ['data.*.url'], b64JsonPaths: [] },
        },
      }],
      galleryApiKey: 'imported-key',
    }
    const params = new URLSearchParams()
    params.set('settings', JSON.stringify(importedSettings))

    const next = normalizeSettings({
      ...current,
      ...buildSettingsFromUrlParams(current, params),
    })

    // Current key should be preserved (existing settings take priority)
    expect(next.galleryApiKey).toBe('current-key')
    expect(next.customProviders).toHaveLength(1)
    expect(next.customProviders[0]).toMatchObject({ id: 'custom-json' })
  })

  it('imports custom provider settings wrapper from URL params', () => {
    const params = new URLSearchParams()
    params.set('settings', JSON.stringify({
      version: 1,
      settings: {
        customProviders: [{
          id: 'wrapped-custom',
          name: 'Wrapped Custom',
          submit: {
            path: 'images/generations',
            method: 'POST',
            contentType: 'json',
            body: { model: '$profile.model', prompt: '$prompt' },
            result: { imageUrlPaths: ['data.*.url'], b64JsonPaths: [] },
          },
        }],
        galleryApiKey: 'wrapped-key',
      },
    }))

    const next = normalizeSettings({
      ...DEFAULT_SETTINGS,
      ...buildSettingsFromUrlParams(DEFAULT_SETTINGS, params),
    })

    expect(next.customProviders).toHaveLength(1)
    expect(next.customProviders[0]).toMatchObject({ id: 'wrapped-custom', name: 'Wrapped Custom' })
    expect(next.galleryApiKey).toBe('wrapped-key')
  })

  it('imports video API keys from URL settings', () => {
    const params = new URLSearchParams()
    params.set('settings', JSON.stringify({
      videoApiKeys: {
        'kling-v3': 'kling-key',
        'viduq3': 'vidu-key',
      },
      selectedVideoModel: 'viduq3',
    }))

    const next = normalizeSettings({
      ...DEFAULT_SETTINGS,
      ...buildSettingsFromUrlParams(DEFAULT_SETTINGS, params),
    })

    expect(next.videoApiKeys['kling-v3']).toBe('kling-key')
    expect(next.videoApiKeys['viduq3']).toBe('vidu-key')
    expect(next.selectedVideoModel).toBe('viduq3')
  })
})
