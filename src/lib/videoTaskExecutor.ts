/**
 * 视频任务执行器 - 独立于图片生成逻辑
 * 负责火山引擎视频生成任务的提交、轮询、恢复
 */

import type { ApiProfile, TaskRecord, VideoParams } from '../types'
import {
  submitVolcengineVideoTask,
  pollVolcengineVideoTask,
  getVolcengineQueuedVideoResult,
  VIDEO_POLL_INTERVAL_MS,
} from './volcengineVideoApi'
import { storeImage, getImage } from './db'

// ===== 状态管理 =====

const videoCache = new Map<string, { videoUrl: string; coverUrl: string }>()
const videoPollingTimers = new Map<string, ReturnType<typeof setTimeout>>()

export interface VideoTaskOptions {
  prompt: string
  params: VideoParams
  profile: ApiProfile
  taskId: string
  model?: string
  inputImageIds?: string[]
  onStatusUpdate: (taskId: string, patch: Partial<TaskRecord>) => void
  onTaskComplete: (taskId: string, videoUrl: string, coverImageId: string | null) => void
  onTaskError: (taskId: string, error: string) => void
}

// ===== 提交视频任务 =====

export async function submitVideoTask(options: VideoTaskOptions): Promise<void> {
  const controller = new AbortController()

  try {
    // 1. 提交任务
    const { taskId } = await submitVolcengineVideoTask({
      prompt: options.prompt,
      params: options.params,
      profile: options.profile,
      model: options.model,
      signal: controller.signal,
    })

    // 2. 记录 task ID
    options.onStatusUpdate(options.taskId, {
      volcengineTaskId: taskId,
      volcengineRecoverable: false,
      videoParams: options.params,
    })

    // 3. 开始轮询
    await pollVideoTaskWithRecovery(taskId, options, controller)

  } catch (err) {
    if (controller.signal.aborted) return

    const errorMessage = err instanceof Error ? err.message : String(err)
    options.onStatusUpdate(options.taskId, {
      volcengineRecoverable: true,
      status: 'error',
      error: '视频任务提交中断，之后会继续查询结果。',
      finishedAt: Date.now(),
    })

    // 如果已有 taskId，安排恢复轮询
    const task = options.taskId
    scheduleVideoRecovery(task, options)
  }
}

// ===== 轮询视频任务 =====

async function pollVideoTaskWithRecovery(
  taskId: string,
  options: VideoTaskOptions,
  controller: AbortController,
): Promise<void> {
  try {
    const result = await pollVolcengineVideoTask(
      taskId,
      options.profile,
      controller.signal,
      (status) => {
        options.onStatusUpdate(options.taskId, { status: 'running' as const })
      },
    )

    // 成功 - 存储封面图
    const coverImageId = result.coverImageUrl
      ? await storeCoverImage(result.coverImageUrl)
      : null

    // 缓存视频 URL
    videoCache.set(taskId, { videoUrl: result.videoUrl, coverUrl: result.coverImageUrl })

    options.onTaskComplete(options.taskId, result.videoUrl, coverImageId)

  } catch (err) {
    if (controller.signal.aborted) return

    const errorMessage = err instanceof Error ? err.message : String(err)

    // 判断是否可恢复
    if (isRecoverableError(err)) {
      options.onStatusUpdate(options.taskId, {
        volcengineRecoverable: true,
        status: 'error' as const,
        error: '与火山引擎的连接已断开，之后会继续查询任务结果。',
        finishedAt: Date.now(),
      })
      scheduleVideoRecovery(options.taskId, options)
    } else {
      options.onTaskError(options.taskId, errorMessage)
    }
  }
}

// ===== 封面图存储 =====

async function storeCoverImage(url: string): Promise<string> {
  try {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) throw new Error(`封面图下载失败: HTTP ${response.status}`)

    const blob = await response.blob()
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let binary = ''
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    }
    const dataUrl = `data:${blob.type || 'image/png'};base64,${btoa(binary)}`

    const imgId = await storeImage(dataUrl, 'generated')
    return imgId
  } catch (err) {
    console.error('Failed to store cover image:', err)
    return ''
  }
}

// ===== 断线恢复 =====

function scheduleVideoRecovery(taskId: string, options: VideoTaskOptions, delayMs = VIDEO_POLL_INTERVAL_MS) {
  // Clear existing timer
  const existing = videoPollingTimers.get(taskId)
  if (existing) clearTimeout(existing)

  const timer = setTimeout(() => {
    videoPollingTimers.delete(taskId)
    void recoverVideoTask(taskId, options)
  }, delayMs)

  videoPollingTimers.set(taskId, timer)
}

async function recoverVideoTask(taskId: string, options: VideoTaskOptions): Promise<void> {
  try {
    // 获取已有的 volcengineTaskId
    const state = getCurrentTaskState(options)
    if (!state.volcengineTaskId) {
      options.onTaskError(taskId, '无法恢复：未找到视频任务 ID')
      return
    }

    const result = await getVolcengineQueuedVideoResult(state.volcengineTaskId, options.profile)

    const coverImageId = result.coverImageUrl
      ? await storeCoverImage(result.coverImageUrl)
      : null

    videoCache.set(taskId, { videoUrl: result.videoUrl, coverUrl: result.coverImageUrl })

    options.onTaskComplete(taskId, result.videoUrl, coverImageId)

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)

    // 如果任务仍在运行中，继续恢复
    if (errorMessage.includes('仍在') || errorMessage.includes('submitted') ||
        errorMessage.includes('queued') || errorMessage.includes('running')) {
      scheduleVideoRecovery(taskId, options, VIDEO_POLL_INTERVAL_MS)
      return
    }

    options.onTaskError(taskId, errorMessage)
  }
}

// ===== 工具函数 =====

function isRecoverableError(err: unknown): boolean {
  if (err instanceof TypeError) return true  // Network error
  if (err instanceof DOMException && err.name === 'AbortError') return false
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes('fetch') || msg.includes('network') || msg.includes('ECONNREFUSED')
}

function getCurrentTaskState(options: VideoTaskOptions): { volcengineTaskId?: string } {
  // 从 onStatusUpdate 回调中获取当前任务状态（简化实现）
  return {}
}

// ===== 公开 API =====

/**
 * 获取缓存的视频 URL
 */
export function getCachedVideo(taskId: string): { videoUrl: string; coverUrl: string } | undefined {
  return videoCache.get(taskId)
}

/**
 * 取消视频任务轮询
 */
export function cancelVideoTask(taskId: string): void {
  const timer = videoPollingTimers.get(taskId)
  if (timer) {
    clearTimeout(timer)
    videoPollingTimers.delete(taskId)
  }
}

/**
 * 获取所有正在轮询的任务 ID
 */
export function getPollingVideoTaskIds(): string[] {
  return Array.from(videoPollingTimers.keys())
}
