import type { VideoParams, VideoProfile } from '../types'
import { buildApiUrl, isApiProxyAvailable } from './devProxy'

export const VIDEO_POLL_INTERVAL_MS = 5000

export interface VideoApiResult {
  videoUrl: string
  coverImageUrl: string
  revisedPrompt?: string
}

/** 已加载的参考图，含 data URL */
export interface InputImageData {
  /** IndexedDB 中的图片 ID */
  id: string
  /** 图片的 data URL（base64） */
  dataUrl: string
}

export interface CallVideoApiOptions {
  prompt: string
  params: VideoParams
  profile: VideoProfile
  model?: string
  /** 图生视频参考图 */
  inputImages?: InputImageData[]
  onTaskEnqueued?: (task: { taskId: string }) => void
  onStatusChange?: (status: string) => void
  signal?: AbortSignal
}

// ===== 提交视频生成任务 =====

export async function submitVideoTask(opts: CallVideoApiOptions): Promise<{ taskId: string }> {
  const useProxy = isApiProxyAvailable()
  const url = buildApiUrl(opts.profile.baseUrl, 'video/generations', null, useProxy)

  const body: Record<string, unknown> = {
    model: opts.model || opts.profile.model,
    prompt: opts.prompt,
    // duration 转为整数（秒），Seedance 2.0 支持 4-15
    duration: normalizeDuration(opts.params.duration),
    ratio: opts.params.ratio,
  }

  // 可选参数（对齐 Seedance 2.0 官方字段名）
  if (opts.params.resolution) body.resolution = opts.params.resolution
  if (opts.params.seed != null && opts.params.seed > 0) body.seed = opts.params.seed
  if (opts.params.watermark != null) body.watermark = opts.params.watermark
  if (opts.params.generateAudio != null) body.generate_audio = opts.params.generateAudio
  if (opts.params.cameraFixed != null) body.camera_fixed = opts.params.cameraFixed

  // 图生视频：附加参考图
  if (opts.inputImages && opts.inputImages.length > 0) {
    body.images = opts.inputImages.map((img) => ({
      image_url: img.dataUrl,
    }))
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
    throw new Error(await getVideoErrorMessage(response))
  }

  const json = await response.json() as Record<string, unknown>
  const taskId = resolveTaskId(json)
  if (!taskId) {
    throw new Error('视频服务未返回有效的任务 ID')
  }

  opts.onTaskEnqueued?.({ taskId })
  return { taskId }
}

// ===== 轮询视频任务状态 =====

export async function pollVideoTask(
  taskId: string,
  profile: VideoProfile,
  signal?: AbortSignal,
  onStatusChange?: (status: string) => void,
): Promise<VideoApiResult> {
  while (true) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const task = await getVideoTaskStatus(taskId, profile, signal)

    onStatusChange?.(String(task.status))

    const statusStr = String(task.status)
    if (statusStr === 'succeed' || statusStr === 'completed' || statusStr === 'success') {
      const content = task.content as Record<string, unknown> | undefined
      const videoUrl = content?.video_url as string | undefined || task.video_url as string | undefined
      const coverUrl = content?.cover_image_url as string | undefined || task.cover_image_url as string | undefined || ''
      if (!videoUrl) {
        throw new Error('视频任务成功但未返回视频 URL')
      }
      return {
        videoUrl,
        coverImageUrl: coverUrl,
      }
    }

    if (statusStr === 'failed' || statusStr === 'error') {
      const errorObj = task.error as Record<string, unknown> | undefined
      const errorMsg = errorObj?.message as string | undefined || task.error_message as string | undefined || '视频生成失败'
      throw new Error(errorMsg)
    }

    // submitted, queued, running, processing - wait and retry
    await sleep(VIDEO_POLL_INTERVAL_MS, signal)
  }
}

// ===== 查询单个任务状态 =====

async function getVideoTaskStatus(
  taskId: string,
  profile: VideoProfile,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const useProxy = isApiProxyAvailable()
  const url = buildApiUrl(profile.baseUrl, `video/tasks/${encodeURIComponent(taskId)}`, null, useProxy)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${profile.apiKey}`,
    },
    signal,
  })

  if (!response.ok) {
    if (response.status === 429 || response.status >= 500) {
      await sleep(VIDEO_POLL_INTERVAL_MS, signal)
      return getVideoTaskStatus(taskId, profile, signal)
    }
    throw new Error(await getVideoErrorMessage(response))
  }

  return await response.json() as Record<string, unknown>
}

// ===== 断线恢复查询 =====

export async function getQueuedVideoResult(
  taskId: string,
  profile: VideoProfile,
): Promise<VideoApiResult> {
  const task = await getVideoTaskStatus(taskId, profile)

  const status = typeof task.status === 'string' ? task.status : ''
  const videoUrl = (task.content as Record<string, unknown> | undefined)?.video_url as string | undefined
    || task.video_url as string | undefined
  const coverUrl = (task.content as Record<string, unknown> | undefined)?.cover_image_url as string | undefined
    || task.cover_image_url as string | undefined
    || ''

  if (status === 'succeed' || status === 'completed' || status === 'success') {
    if (!videoUrl) {
      throw new Error('视频任务成功但未返回视频 URL')
    }
    return {
      videoUrl,
      coverImageUrl: coverUrl,
    }
  }

  if (status === 'failed' || status === 'error') {
    const errorObj = task.error as Record<string, unknown> | undefined
    const errorMsg = (errorObj?.message as string) || (task.error_message as string) || '视频生成失败'
    throw new Error(errorMsg)
  }

  throw new Error(`视频任务仍在 ${status || '未知'} 状态`)
}

// ===== 工具函数 =====

/** 统一将 duration 转为整数秒 */
function normalizeDuration(d: number | string): number {
  if (typeof d === 'number') return d
  // 处理 "5s", "10s" 等格式
  const num = parseInt(d.replace(/[^\d]/g, ''), 10)
  return Number.isFinite(num) ? num : 5
}

function resolveTaskId(json: Record<string, unknown>): string {
  // Try common task ID field names
  if (typeof json.id === 'string') return json.id.trim()
  if (typeof json.task_id === 'string') return json.task_id.trim()
  if (typeof json.taskId === 'string') return json.taskId.trim()
  if (typeof json.data === 'object' && json.data) {
    const data = json.data as Record<string, unknown>
    if (typeof data.id === 'string') return data.id.trim()
    if (typeof data.task_id === 'string') return data.task_id.trim()
    if (typeof data.taskId === 'string') return data.taskId.trim()
  }
  return ''
}

async function getVideoErrorMessage(response: Response): Promise<string> {
  let errorMsg = `HTTP ${response.status}`
  try {
    const errJson = await response.json() as Record<string, unknown>
    const errorObj = errJson.error as Record<string, unknown> | undefined
    if (errorObj?.message) {
      errorMsg = errorObj.message as string
    } else if (typeof errJson.message === 'string') {
      errorMsg = errJson.message
    } else if (typeof errJson.error === 'string') {
      errorMsg = errJson.error
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
