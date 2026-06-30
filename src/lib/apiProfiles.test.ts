import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_FAL_BASE_URL,
  DEFAULT_FAL_MODEL,
  DEFAULT_IMAGES_MODEL,
  DEFAULT_SETTINGS,
  createDefaultOpenAIProfile,
  createDefaultFalProfile,
  findEquivalentApiProfile,
  importCustomProviderDefinitionFromJson,
  importCustomProviderSettingsFromJson,
  mergeImportedSettings,
  normalizeSettings,
  switchApiProfileProvider,
  validateApiProfile,
} from './apiProfiles'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('validateApiProfile', () => {
  it('allows empty API URL when API proxy is enabled and available', () => {
    vi.stubEnv('VITE_API_PROXY_AVAILABLE', 'true')

    expect(validateApiProfile(createDefaultOpenAIProfile({
      baseUrl: '',
      apiKey: 'test-key',
      apiProxy: true,
    }))).toBeNull()
  })

  it('still requires API URL when API proxy is unavailable', () => {
    expect(validateApiProfile(createDefaultOpenAIProfile({
      baseUrl: '',
      apiKey: 'test-key',
      apiProxy: true,
    }))).toBe('缺少 API URL')
  })
})

describe('mergeImportedSettings', () => {
  it('merges gallery API key from legacy imported settings when apiMode is images', () => {
    const merged = mergeImportedSettings(DEFAULT_SETTINGS, {
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'imported-key',
      model: 'imported-model',
      timeout: 120,
      apiMode: 'images',
      codexCli: true,
      apiProxy: true,
    })

    expect(merged.galleryApiKey).toBe('imported-key')
  })

  it('merges custom providers and API keys from wrapped import', () => {
    const merged = mergeImportedSettings(DEFAULT_SETTINGS, {
      customProviders: [{
        id: 'custom-imported',
        name: 'Custom Imported',
        submit: { path: 'images/generations' },
      }],
      galleryApiKey: 'imported-gallery-key',
      agentApiKey: 'imported-agent-key',
      videoApiKeys: { 'kling-v3': 'imported-video-key' },
    })

    expect(merged.customProviders.some((p) => p.id === 'custom-imported')).toBe(true)
    expect(merged.galleryApiKey).toBe('imported-gallery-key')
    expect(merged.agentApiKey).toBe('imported-agent-key')
    expect(merged.videoApiKeys['kling-v3']).toBe('imported-video-key')
  })

  it('keeps existing keys when current settings already have them', () => {
    const current = mergeImportedSettings(DEFAULT_SETTINGS, {
      galleryApiKey: 'current-gallery-key',
      agentApiKey: 'current-agent-key',
    })
    const merged = mergeImportedSettings(current, {
      galleryApiKey: 'imported-gallery-key',
      agentApiKey: 'imported-agent-key',
    })

    // Existing keys should be preserved
    expect(merged.galleryApiKey).toBe('current-gallery-key')
    expect(merged.agentApiKey).toBe('current-agent-key')
  })

  it('merges video API keys without overwriting existing ones', () => {
    const current = mergeImportedSettings(DEFAULT_SETTINGS, {
      videoApiKeys: { 'kling-v3': 'current-kling-key' },
    })
    const merged = mergeImportedSettings(current, {
      videoApiKeys: { 'viduq3': 'imported-vidu-key' },
    })

    expect(merged.videoApiKeys['kling-v3']).toBe('current-kling-key')
    expect(merged.videoApiKeys['viduq3']).toBe('imported-vidu-key')
  })
})

describe('custom providers', () => {
  it('normalizes custom provider definitions from async template', () => {
    const settings = normalizeSettings({
      customProviders: [{
        id: 'custom-async',
        name: 'Custom Async',
        template: 'openai-compatible-async',
        generationPath: '/v1/images/generations',
        editPath: '/v1/images/edits',
        taskPath: '/v1/images/tasks/{task_id}',
      }],
      galleryApiKey: 'test-key',
    })

    expect(settings.customProviders[0]).toMatchObject({
      id: 'custom-async',
      template: 'http-image',
      submit: {
        path: 'images/generations',
        query: { async: 'true' },
        taskIdPath: 'data',
      },
      editSubmit: {
        path: 'images/edits',
        query: { async: 'true' },
        taskIdPath: 'data',
      },
      poll: {
        path: 'images/tasks/{task_id}',
      },
    })
  })

  it('normalizes an Apimart-style task manifest', () => {
    const provider = importCustomProviderDefinitionFromJson(JSON.stringify({
      name: 'Apimart GPT-Image-2',
      template: 'http-image',
      submit: {
        path: '/v1/images/generations',
        method: 'POST',
        contentType: 'json',
        body: {
          model: '$profile.model',
          prompt: '$prompt',
          n: '$params.n',
          size: '$params.size',
          resolution: '2k',
          image_urls: '$inputImages.dataUrls',
        },
        taskIdPath: 'data.0.task_id',
      },
      poll: {
        path: '/v1/tasks/{task_id}',
        method: 'GET',
        query: { language: 'zh' },
        statusPath: 'data.status',
        successValues: ['completed'],
        failureValues: ['failed', 'cancelled'],
        result: {
          imageUrlPaths: ['data.result.images.*.url.*'],
        },
      },
    }))

    expect(provider).toMatchObject({
      template: 'http-image',
      submit: {
        path: 'images/generations',
        taskIdPath: 'data.0.task_id',
      },
      poll: {
        path: 'tasks/{task_id}',
        query: { language: 'zh' },
        successValues: ['completed'],
        result: {
          imageUrlPaths: ['data.result.images.*.url.*'],
        },
      },
    })
  })

  it('imports wrapped custom provider settings with profiles', () => {
    const imported = importCustomProviderSettingsFromJson(JSON.stringify({
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
      profiles: [{
        name: 'Custom JSON',
        provider: 'custom-json',
        baseUrl: 'https://custom.example.com/v1',
        model: 'custom-model',
        apiMode: 'images',
      }],
    }))

    expect(imported.customProviders[0]).toMatchObject({ id: 'custom-json', name: 'Custom JSON' })
    expect(imported.profiles[0]).toMatchObject({
      name: 'Custom JSON',
      provider: 'custom-json',
      baseUrl: 'https://custom.example.com/v1',
      apiKey: '',
      model: 'custom-model',
      apiMode: 'images',
    })
  })

  it('imports wrapped custom provider settings from a json code block', () => {
    const imported = importCustomProviderSettingsFromJson(`\`\`\`json
{"customProviders":[{"id":"custom-json","name":"Custom JSON","submit":{"path":"images/generations","method":"POST","contentType":"json","body":{"model":"$profile.model","prompt":"$prompt"},"result":{"imageUrlPaths":["data.result.images.*.url.*"],"b64JsonPaths":[]}}}],"profiles":[{"name":"Custom JSON","provider":"custom-json","baseUrl":"https://custom.example.com/v1","model":"custom-model","apiMode":"images"}]}
\`\`\``)

    expect(imported.customProviders[0]).toMatchObject({ id: 'custom-json' })
    expect(imported.customProviders[0].submit.result).toMatchObject({
      imageUrlPaths: ['data.result.images.*.url.*'],
    })
    expect(imported.profiles[0]).toMatchObject({
      provider: 'custom-json',
      baseUrl: 'https://custom.example.com/v1',
    })
  })

  it('rejects markdown-corrupted profile fields when importing wrapped settings', () => {
    expect(() => importCustomProviderSettingsFromJson(JSON.stringify({
      customProviders: [{
        id: 'custom-apimart',
        name: 'APIMart',
        submit: { path: 'images/generations' },
      }],
      profiles: [{
        name: 'APIMart',
        provider: 'custom-apimart',
        baseUrl: '[https://api.apimart.ai/v1',
        model: 'gpt-image-2-official',
        apiMode: 'images](https://api.apimart.ai/v1%22,%22model%22:%22gpt-image-2-official%22,%22apiMode%22:%22images)',
      }],
    }))).toThrow('JSON 包含 Markdown 链接')
  })

  it('does not inherit fal URL and model when switching to a custom provider', () => {
    const provider = importCustomProviderDefinitionFromJson(JSON.stringify({
      name: 'Custom Provider',
      template: 'http-image',
      submit: { path: 'images/generations' },
    }))
    const profile = switchApiProfileProvider(createDefaultFalProfile(), provider.id, provider)

    expect(profile.provider).toBe(provider.id)
    expect(profile.baseUrl).toBe(DEFAULT_SETTINGS.baseUrl)
    expect(profile.model).toBe(DEFAULT_IMAGES_MODEL)
  })

  it('enables streaming by default', () => {
    expect(createDefaultOpenAIProfile().streamImages).toBe(true)
    expect(createDefaultOpenAIProfile().streamPartialImages).toBe(1)
    // DEFAULT_SETTINGS has streamImages: false (user preference for gallery)
    expect(DEFAULT_SETTINGS.streamImages).toBe(false)
    expect(DEFAULT_SETTINGS.streamPartialImages).toBe(1)
  })

  it('enables Agent submit auto scroll by default', () => {
    expect(DEFAULT_SETTINGS.agentScrollToBottomAfterSubmit).toBe(true)
    expect(normalizeSettings({}).agentScrollToBottomAfterSubmit).toBe(true)
    expect(normalizeSettings({ agentScrollToBottomAfterSubmit: false }).agentScrollToBottomAfterSubmit).toBe(false)
  })

  it('restores OpenAI-compatible URL after switching through fal.ai', () => {
    const openaiProfile = createDefaultOpenAIProfile({
      baseUrl: 'https://api.compat.example.com/v1',
      model: 'custom-openai-model',
      apiProxy: false,
    })

    const falProfile = switchApiProfileProvider(openaiProfile, 'fal')
    const restoredProfile = switchApiProfileProvider(falProfile, 'openai')

    expect(falProfile.baseUrl).toBe(DEFAULT_FAL_BASE_URL)
    expect(restoredProfile.baseUrl).toBe('https://api.compat.example.com/v1')
    expect(restoredProfile.model).toBe('custom-openai-model')
    expect(restoredProfile.apiProxy).toBe(false)
  })
})
