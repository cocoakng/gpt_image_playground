import type { ApiProfile } from '../types'
import type { VideoParams, VolcengineTaskResponse } from '../types'

export const DEFAULT_VOLCENGINE_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
export const DEFAULT_VOLCENGINE_MODEL = 'doubao-seedance-1-0-pro'
export const VIDEO_POLL_INTERVAL_MS = 5000

export interface VideoApiResult {
  videoUrl: string
  coverImageUrl: string
  revisedPrompt?: string
}

export interface CallVideoApiOptions {
  prompt: string
  params: VideoParams
  profile: ApiProfile
  model?: string
  onTaskEnqueued?: (task: { taskId: string }) => void
  onStatusChange?: (status: string) => void
  signal?: AbortSignal
}

// ===== 提交视频生成任务 =====

export async function submitVolcengineVideoTask(opts: CallVideoApiOptions): Promise<{ taskId: string }> {
  const baseUrl = opts.profile.baseUrl || DEFAULT_VOLCENGINE_BASE_URL
  const model = opts.model || opts.profile.model || DEFAULT_VOLCENGINE_MODEL
  const endpoint = `bots/${encodeURIComponent(model)}/video_generation`
  const url = buildVolcengineUrl(baseUrl, endpoint)

  const body: Record<string, unknown> = {
    prompt: opts.prompt,
    resolution: opts.params.resolution,
    duration: opts.params.duration,
    ratio: opts.params.ratio,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.profile.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  })

  if (!response.ok) {
    throw new Error(await getVolcengineErrorMessage(response))
  }

  const json = await response.json() as Record<string, unknown>
  const taskId = typeof json.id === 'string' ? json.id.trim() : ''
  if (!taskId) {
    throw new Error('火山引擎未返回有效的任务 ID')
  }

  opts.onTaskEnqueued?.({ taskId })
  return { taskId }
}

// ===== 轮询视频任务状态 =====

export async function pollVolcengineVideoTask(
  taskId: string,
  profile: ApiProfile,
  signal?: AbortSignal,
  onStatusChange?: (status: string) => void,
): Promise<VideoApiResult> {
  const baseUrl = profile.baseUrl || DEFAULT_VOLCENGINE_BASE_URL

  while (true) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const task = await getVolcengineTaskStatus(taskId, baseUrl, profile.apiKey, signal)

    onStatusChange?.(task.status)

    if (task.status === 'succeed') {
      if (!task.content?.video_url) {
        throw new Error('火山引擎任务成功但未返回视频 URL')
      }
      return {
        videoUrl: task.content.video_url,
        coverImageUrl: task.content.cover_image_url || '',
      }
    }

    if (task.status === 'failed') {
      const errorMsg = task.error?.message || '火山引擎视频生成失败'
      throw new Error(errorMsg)
    }

    // submitted, queued, running - wait and retry
    await sleep(VIDEO_POLL_INTERVAL_MS, signal)
  }
}

// ===== 查询单个任务状态 =====

async function getVolcengineTaskStatus(
  taskId: string,
  baseUrl: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<VolcengineTaskResponse> {
  const endpoint = `tasks/${encodeURIComponent(taskId)}`
  const url = buildVolcengineUrl(baseUrl, endpoint)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
  })

  if (!response.ok) {
    // Retry on transient errors
    if (response.status === 429 || response.status >= 500) {
      await sleep(VIDEO_POLL_INTERVAL_MS, signal)
      return getVolcengineTaskStatus(taskId, baseUrl, apiKey, signal)
    }
    throw new Error(await getVolcengineErrorMessage(response))
  }

  return await response.json() as VolcengineTaskResponse
}

// ===== 断线恢复查询 =====

export async function getVolcengineQueuedVideoResult(
  taskId: string,
  profile: ApiProfile,
): Promise<VideoApiResult> {
  const task = await getVolcengineTaskStatus(taskId, profile.baseUrl || DEFAULT_VOLCENGINE_BASE_URL, profile.apiKey)

  if (task.status === 'succeed') {
    if (!task.content?.video_url) {
      throw new Error('火山引擎任务成功但未返回视频 URL')
    }
    return {
      videoUrl: task.content.video_url,
      coverImageUrl: task.content.cover_image_url || '',
    }
  }

  if (task.status === 'failed') {
    const errorMsg = task.error?.message || '火山引擎视频生成失败'
    throw new Error(errorMsg)
  }

  throw new Error(`视频任务仍在 ${task.status} 状态`)
}

// ===== 工具函数 =====

function buildVolcengineUrl(baseUrl: string, path: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '')
  const cleanPath = path.replace(/^\/+/, '')
  // Volcengine API doesn't use /v1 prefix for the bots/tasks endpoints
  return `${trimmed}/${cleanPath}`
}

async function getVolcengineErrorMessage(response: Response): Promise<string> {
  let errorMsg = `HTTP ${response.status}`
  try {
    const errJson = await response.json() as Record<string, unknown>
    const errorObj = errJson.error as Record<string, unknown> | undefined
    if (errorObj?.message) {
      errorMsg = errorObj.message as string
    } else if (typeof errJson.message === 'string') {
      errorMsg = errJson.message
    } else if (errorObj?.code) {
      errorMsg = `Error ${errorObj.code}`
    } else {
      errorMsg = JSON.stringify(errJson)
    }
  } catch {
    try {
      errorMsg = await response.text()
    } catch {
      /* ignore */
    }
  }
  return errorMsg
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timeoutId = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timeoutId)
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
}
