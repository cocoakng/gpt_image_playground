/** 视频任务状态展示映射 */

/** 后端返回的视频任务状态 → 前端展示文案 */
const VIDEO_STATUS_LABELS: Record<string, string> = {
  submitted: '已提交',
  queued: '排队中',
  running: '生成中',
  processing: '处理中',
  succeed: '成功',
  completed: '完成',
  success: '成功',
  failed: '失败',
  error: '错误',
}

/** 状态对应的图标类型 */
const VIDEO_STATUS_ICONS: Record<string, 'spinner' | 'clock' | 'film' | 'check' | 'alert'> = {
  submitted: 'clock',
  queued: 'clock',
  running: 'film',
  processing: 'film',
  succeed: 'check',
  completed: 'check',
  success: 'check',
  failed: 'alert',
  error: 'alert',
}

/**
 * 将后端视频状态映射为用户友好的展示文案
 */
export function getVideoStatusLabel(videoStatus: string | undefined): string {
  if (!videoStatus) return '生成中...'
  return VIDEO_STATUS_LABELS[videoStatus] || '生成中...'
}

/**
 * 获取视频状态对应的图标类型
 */
export function getVideoStatusIcon(videoStatus: string | undefined): string {
  if (!videoStatus) return 'spinner'
  return VIDEO_STATUS_ICONS[videoStatus] || 'spinner'
}

/**
 * 判断该状态是否表示任务仍在进行中
 */
export function isVideoTaskInProgress(videoStatus: string | undefined): boolean {
  if (!videoStatus) return true
  return ['submitted', 'queued', 'running', 'processing'].includes(videoStatus)
}
