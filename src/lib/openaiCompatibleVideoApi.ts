import type { VideoParams, VideoProfile, VideoReference, AudioReference } from '../types'
import { buildApiUrl, isApiProxyAvailable } from './devProxy'
import { storeVideo } from './db'

export const VIDEO_POLL_INTERVAL_MS = 5000

export interface VideoApiResult {
  videoUrl: string
  videoStoreId: string
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
  /** 多模态参考 - 视频 */
  inputVideos?: VideoReference[]
  /** 多模态参考 - 音频 */
  inputAudios?: AudioReference[]
  onTaskEnqueued?: (task: { taskId: string }) => void
  onStatusChange?: (status: string, progress?: number) => void
  signal?: AbortSignal
}

// ===== 提交视频生成任务 =====

export async function submitVideoTask(opts: CallVideoApiOptions): Promise<{ taskId: string }> {
  const useProxy = isApiProxyAvailable()
  const url = buildApiUrl(opts.profile.baseUrl, 'videos', null, useProxy)

  const body: Record<string, unknown> = {
    model: opts.params.model || opts.model,
    prompt: opts.prompt,
  }

  // 根据模型类型映射参数
  const model = opts.params.model || opts.model || ''

  // ===== 先上传所有参考素材（所有模型都需要） =====
  const uploadedImageUrls = opts.inputImages?.length
    ? await Promise.all(
        opts.inputImages.map((img) =>
          uploadMedia(img.dataUrl, 'image.png', opts.profile.apiKey, opts.profile.baseUrl, opts.signal)
        )
      )
    : []

  const uploadedVideoUrls = opts.inputVideos?.length
    ? await Promise.all(
        opts.inputVideos.map((vid) =>
          uploadMedia(vid.dataUrl, vid.fileName, opts.profile.apiKey, opts.profile.baseUrl, opts.signal)
        )
      )
    : []

  const uploadedAudioUrls = opts.inputAudios?.length
    ? await Promise.all(
        opts.inputAudios.map((aud) =>
          uploadMedia(aud.dataUrl, aud.fileName, opts.profile.apiKey, opts.profile.baseUrl, opts.signal)
        )
      )
    : []

  // ===== happyhorse-1.0: 扁平结构 + content 数组（Sora 兼容格式） =====
  if (model === 'happyhorse-1.0') {
    // 顶层参数
    body.resolution = (opts.params.resolution || '720p').toUpperCase()
    if (opts.params.duration) body.duration = opts.params.duration
    if (opts.params.ratio && opts.params.ratio !== 'adaptive') body.ratio = opts.params.ratio
    if (opts.params.seed != null && opts.params.seed > 0) body.seed = opts.params.seed

    // 构建 content 数组（Sora 兼容格式）
    const content: Array<Record<string, unknown>> = []
    content.push({ type: 'text', text: opts.prompt })

    for (const url of uploadedImageUrls) {
      content.push({ type: 'image_url', image_url: { url } })
    }
    for (const url of uploadedVideoUrls) {
      content.push({ type: 'video_url', video_url: { url } })
    }
    body.content = content

    // 自动推断 mode
    const imageCount = uploadedImageUrls.length
    const hasVideoRefs = uploadedVideoUrls.length > 0
    if (hasVideoRefs) {
      body.mode = 'video_edit'
    } else if (imageCount === 0) {
      body.mode = 't2v'
    } else if (imageCount === 1) {
      body.mode = 'i2v'
    } else {
      body.mode = 'r2v'
    }
  }
  // ===== doubao-seedance 模型 =====
  else if (model.startsWith('doubao-seedance')) {
    body.prompt = opts.prompt
    body.seconds = String(opts.params.duration || 5)

    if (opts.params.ratio && opts.params.ratio !== 'adaptive') body.ratio = opts.params.ratio
    if (opts.params.resolution) body.resolution = opts.params.resolution.toUpperCase()
    if (opts.params.generateAudio != null) body.generate_audio = opts.params.generateAudio

    const hasVideoRefs = uploadedVideoUrls.length > 0
    const hasAudioRefs = uploadedAudioUrls.length > 0
    const imageCount = uploadedImageUrls.length

    // 当有视频/音频参考或多张图片时，使用 content 数组模式（推荐）
    if (hasVideoRefs || hasAudioRefs || imageCount > 2) {
      body.mode = 'reference_material'

      const content: Array<Record<string, unknown>> = []
      content.push({ type: 'text', text: opts.prompt })

      for (const url of uploadedImageUrls) {
        content.push({
          type: 'image_url',
          image_url: { url },
          role: 'reference_image',
          name: String(content.length),
        })
      }
      for (const url of uploadedVideoUrls) {
        content.push({
          type: 'video_url',
          video_url: { url },
          role: 'reference_video',
          name: String(content.length),
        })
      }
      for (const url of uploadedAudioUrls) {
        content.push({
          type: 'audio_url',
          audio_url: { url },
          role: 'reference_audio',
          name: String(content.length),
        })
      }
      body.content = content
    } else {
      // 传统字段模式
      if (imageCount === 0 && !hasVideoRefs && !hasAudioRefs) {
        body.mode = 't2v'
      } else if (imageCount === 1 && !hasVideoRefs && !hasAudioRefs) {
        body.mode = 'i2v'
        body.image_urls = uploadedImageUrls
      } else if (imageCount === 2 && !hasVideoRefs && !hasAudioRefs) {
        body.mode = 'i2v_first_last'
        body.image_urls = uploadedImageUrls
      } else if (imageCount > 0) {
        body.mode = 'reference_images'
        body.reference_images = uploadedImageUrls
      }
      // 有少量视频/音频参考时，附加到 reference_images
      if ((hasVideoRefs || hasAudioRefs) && imageCount <= 2) {
        const refs = [...uploadedImageUrls, ...uploadedVideoUrls.map(u => `video_url:${u}`), ...uploadedAudioUrls]
        if (refs.length > 0) {
          body.reference_images = refs
        }
      }
    }
  }
  // ===== 其他模型（kling/vidu/grok）保持原有逻辑 =====
  else {
    // 时长
    if (model === 'grok-video-3') {
      body.seconds = String(opts.params.grokSeconds || 10)
    } else {
      body.duration = normalizeDuration(opts.params.duration)
    }

    // 比例
    if (opts.params.ratio && opts.params.ratio !== 'adaptive') {
      body.aspect_ratio = opts.params.ratio
    }

    // 分辨率
    if (opts.params.resolution) {
      if (model === 'viduq3' || model === 'grok-video-3') {
        body.resolution = opts.params.resolution
      }
    }

    // Kling 模式
    if (opts.params.klingMode) {
      body.mode = opts.params.klingMode
    }

    // 种子
    if (opts.params.seed != null && opts.params.seed > 0) {
      if (model === 'viduq3') {
        body.seed = opts.params.seed
      }
    }

    // 音频
    if (opts.params.generateAudio != null) {
      if (model === 'kling-v3') {
        body.audio = opts.params.generateAudio
      } else if (model === 'viduq3') {
        body.audio = opts.params.generateAudio
      }
    }

    // 参考素材
    const imageUrls = uploadedImageUrls
    if (imageUrls.length > 0) {
      if (model === 'kling-v3') {
        if (imageUrls.length <= 2) {
          body.image_with_roles = imageUrls.map((url, idx) => {
            const role = imageUrls.length === 1
              ? 'first_frame'
              : idx === 0 ? 'first_frame' : 'last_frame'
            return { url, role }
          })
        } else {
          body.reference_images = imageUrls
        }
      } else if (model === 'viduq3') {
        body.image_urls = imageUrls
      } else if (model === 'grok-video-3') {
        body.images = imageUrls
      }
    }
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
  onStatusChange?: (status: string, progress?: number) => void,
): Promise<VideoApiResult> {
  while (true) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const task = await getVideoTaskStatus(taskId, profile, signal)

    onStatusChange?.(String(task.status), task.progress as number | undefined)

    const statusStr = String(task.status)
    if (statusStr === 'succeed' || statusStr === 'completed' || statusStr === 'success') {
      // 任务完成后，调用下载接口获取视频二进制文件
      const videoBlob = await downloadVideo(taskId, profile, signal)

      // 存入 IndexedDB 持久化
      const videoStoreId = `video_${taskId}`
      await storeVideo(videoStoreId, videoBlob)

      const videoUrl = URL.createObjectURL(videoBlob)

      // 从视频中提取首帧作为封面图
      const coverImageUrl = await extractVideoCover(videoBlob)

      // 提取优化后的提示词
      const revisedPrompt = typeof task.revised_prompt === 'string' ? task.revised_prompt : undefined

      return {
        videoUrl,
        videoStoreId,
        coverImageUrl,
        revisedPrompt,
      }
    }

    if (statusStr === 'failed' || statusStr === 'error') {
      const errorObj = task.error as Record<string, unknown> | undefined
      const rawMsg = errorObj?.message as string | undefined || task.error_message as string | undefined || '视频生成失败'
      throw new Error(extractNestedErrorMessage(rawMsg))
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
  const url = buildApiUrl(profile.baseUrl, `videos/${encodeURIComponent(taskId)}`, null, useProxy)

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

  if (status === 'succeed' || status === 'completed' || status === 'success') {
    // 任务完成后，调用下载接口获取视频二进制文件
    const videoBlob = await downloadVideo(taskId, profile)

    // 存入 IndexedDB 持久化
    const videoStoreId = `video_${taskId}`
    await storeVideo(videoStoreId, videoBlob)

    const videoUrl = URL.createObjectURL(videoBlob)

    // 从视频中提取首帧作为封面图
    const coverImageUrl = await extractVideoCover(videoBlob)

    // 提取优化后的提示词
    const revisedPrompt = typeof task.revised_prompt === 'string' ? task.revised_prompt : undefined

    return {
      videoUrl,
      videoStoreId,
      coverImageUrl,
      revisedPrompt,
    }
  }

  if (status === 'failed' || status === 'error') {
    const errorObj = task.error as Record<string, unknown> | undefined
    const rawMsg = (errorObj?.message as string) || (task.error_message as string) || '视频生成失败'
    throw new Error(extractNestedErrorMessage(rawMsg))
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

// ===== 下载已完成的视频 =====

export async function downloadVideo(
  taskId: string,
  profile: VideoProfile,
  signal?: AbortSignal,
): Promise<Blob> {
  const useProxy = isApiProxyAvailable()
  const url = buildApiUrl(profile.baseUrl, `videos/${encodeURIComponent(taskId)}/content`, null, useProxy)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${profile.apiKey}`,
    },
    signal,
  })

  if (!response.ok) {
    throw new Error(await getVideoErrorMessage(response))
  }

  return await response.blob()
}

/** 从视频 Blob 提取首帧作为封面图 */
export async function extractVideoCover(videoBlob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    const url = URL.createObjectURL(videoBlob)
    video.src = url

    const cleanup = () => URL.revokeObjectURL(url)

    video.addEventListener('error', () => {
      cleanup()
      reject(new Error('无法加载视频以提取封面'))
    })

    video.addEventListener('loadeddata', () => {
      // 跳转到第一帧
      video.currentTime = 0
    })

    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          cleanup()
          reject(new Error('无法获取 canvas 上下文'))
          return
        }
        ctx.drawImage(video, 0, 0)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        cleanup()
        resolve(dataUrl)
      } catch (err) {
        cleanup()
        reject(err)
      }
    }, { once: true })
  })
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
      errorMsg = extractNestedErrorMessage(errorObj.message as string)
    } else if (typeof errJson.message === 'string') {
      errorMsg = extractNestedErrorMessage(errJson.message)
    } else if (typeof errJson.error === 'string') {
      errorMsg = extractNestedErrorMessage(errJson.error)
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

/** 递归解析嵌套 JSON 字符串中的最内层错误信息 */
function extractNestedErrorMessage(msg: string): string {
  // 尝试递归解析嵌套的 JSON 字符串
  let current = msg
  for (let i = 0; i < 5; i++) {
    // 最多解 5 层，防止无限循环
    if (!current.startsWith('{') && !current.startsWith('[')) break
    try {
      const parsed = JSON.parse(current)
      if (typeof parsed === 'object' && parsed !== null) {
        // 优先提取 message 字段
        if (typeof parsed.message === 'string') {
          current = parsed.message
          continue
        }
        // 其次提取 error.message
        if (typeof parsed.error === 'object' && parsed.error !== null) {
          const inner = parsed.error as Record<string, unknown>
          if (typeof inner.message === 'string') {
            current = inner.message
            continue
          }
        }
        // 都没有，说明已经是最内层了
        break
      }
      break
    } catch {
      break
    }
  }
  return current
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

/**
 * 上传媒体文件到视频服务商，获取公网可访问的 URL。
 * 图片用 base64 JSON 方式上传；视频/音频等 blob 资源先 fetch 后再 multipart 上传。
 */
async function uploadMedia(
  dataUrl: string,
  fileName: string,
  apiKey: string,
  baseUrl: string,
  signal?: AbortSignal,
): Promise<string> {
  const useProxy = isApiProxyAvailable()
  const url = buildApiUrl(baseUrl, 'files/upload', null, useProxy)

  let response: Response

  if (dataUrl.startsWith('data:')) {
    // base64 dataUrl: 用 JSON body 直接上传
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ data: dataUrl }),
      signal,
    })
  } else {
    // blob URL: 先 fetch blob，再用 multipart/form-data 上传
    const blob = await fetch(dataUrl).then((r) => r.blob())
    const formData = new FormData()
    formData.append('file', blob, fileName)
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
      signal,
    })
  }

  if (!response.ok) {
    throw new Error(await getVideoErrorMessage(response))
  }

  const json = await response.json() as Record<string, unknown>
  const data = json.data as Record<string, unknown> | undefined
  const uploadedUrl = data?.url as string | undefined || json.url as string | undefined
  if (!uploadedUrl) {
    throw new Error('素材上传成功但未返回 URL')
  }
  return uploadedUrl
}
