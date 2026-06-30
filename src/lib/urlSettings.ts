import type { ApiMode, AppSettings } from '../types'
import { normalizeBaseUrl } from './devProxy'
import {
  DEFAULT_IMAGES_MODEL,
  mergeImportedSettings,
  normalizeSettings,
} from './apiProfiles'

const URL_SETTING_KEYS = ['settings', 'apiUrl', 'apiKey', 'apiMode', 'model']

function pickUrlSettingsPayload(value: unknown): unknown | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  return {
    customProviders: record.customProviders,
    galleryApiKey: record.galleryApiKey,
    agentApiKey: record.agentApiKey,
    videoApiKeys: record.videoApiKeys,
    selectedVideoModel: record.selectedVideoModel,
    agentMaxToolRounds: record.agentMaxToolRounds,
    agentWebSearch: record.agentWebSearch,
  }
}

function getUrlSettingsPayload(searchParams: URLSearchParams): unknown | null {
  const raw = searchParams.get('settings')
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && 'settings' in parsed) {
      return pickUrlSettingsPayload((parsed as { settings?: unknown }).settings ?? null)
    }
    return pickUrlSettingsPayload(parsed)
  } catch {
    return null
  }
}

function activateFirstImportedSettings(currentSettings: AppSettings, importedSettings: unknown): AppSettings {
  if (!importedSettings || typeof importedSettings !== 'object' || Array.isArray(importedSettings)) return currentSettings

  const record = importedSettings as Record<string, unknown>
  const hasKeys = typeof record.galleryApiKey === 'string' || typeof record.agentApiKey === 'string'
    || (record.videoApiKeys && typeof record.videoApiKeys === 'object')
    || typeof record.selectedVideoModel === 'string'
    || (record.customProviders && Array.isArray(record.customProviders) && record.customProviders.length > 0)

  if (!hasKeys) return currentSettings

  return mergeImportedSettings(currentSettings, importedSettings)
}

export function hasUrlSettingParams(searchParams: URLSearchParams) {
  return URL_SETTING_KEYS.some((key) => searchParams.has(key))
}

export function clearUrlSettingParams(searchParams: URLSearchParams) {
  for (const key of URL_SETTING_KEYS) searchParams.delete(key)
}

export function buildSettingsFromUrlParams(currentSettings: Partial<AppSettings> | unknown, searchParams: URLSearchParams): Partial<AppSettings> {
  const importedSettings = getUrlSettingsPayload(searchParams)
  const apiUrlParam = searchParams.get('apiUrl')
  const apiKeyParam = searchParams.get('apiKey')
  const apiModeParam = searchParams.get('apiMode')
  const modelParam = searchParams.get('model')

  const hasLegacyParams = apiUrlParam !== null || apiKeyParam !== null || apiModeParam !== null || modelParam !== null
  const settings = importedSettings == null
    ? normalizeSettings(currentSettings)
    : activateFirstImportedSettings(normalizeSettings(currentSettings), importedSettings)

  if (hasLegacyParams) {
    // Legacy params only set gallery API key
    if (apiKeyParam !== null) {
      settings.galleryApiKey = apiKeyParam.trim()
    }
    if (apiUrlParam !== null) {
      // baseUrl is no longer configurable for gallery; ignore
    }
  }

  return importedSettings == null && !hasLegacyParams ? {} : settings
}
