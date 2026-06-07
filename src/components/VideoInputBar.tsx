import { useRef, useEffect, useState, useCallback } from 'react'
import { useStore, submitTask, addImageFromFile } from '../store'
import { getActiveVideoProfile } from '../lib/apiProfiles'
import VideoParamsSelector from './VideoParamsSelector'
import { dismissAllTooltips } from '../lib/tooltipDismiss'
import Select from './Select'
import type { VideoMode } from '../types'

const MODES: { mode: VideoMode; label: string }[] = [
  { mode: 'text', label: '文生视频' },
  { mode: 'first-frame', label: '图生视频-首帧' },
  { mode: 'first-last-frame', label: '图生视频-首尾帧' },
]

const MAX_IMAGES: Record<VideoMode, number> = {
  text: 0,
  'first-frame': 1,
  'first-last-frame': 2,
}

export default function VideoInputBar() {
  const prompt = useStore((s) => s.prompt)
  const setPrompt = useStore((s) => s.setPrompt)
  const videoParams = useStore((s) => s.videoParams)
  const setVideoParams = useStore((s) => s.setVideoParams)
  const videoMode = useStore((s) => s.videoMode)
  const setVideoMode = useStore((s) => s.setVideoMode)
  const videoProfiles = useStore((s) => s.videoProfiles)
  const activeVideoProfileId = useStore((s) => s.activeVideoProfileId)
  const setActiveVideoProfileId = useStore((s) => s.setActiveVideoProfileId)
  const inputImages = useStore((s) => s.inputImages)
  const removeInputImage = useStore((s) => s.removeInputImage)
  const showSettings = useStore((s) => s.showSettings)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const showToast = useStore((s) => s.showToast)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [prompt])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const maxImages = MAX_IMAGES[videoMode]
    const currentCount = inputImages.length
    for (let i = 0; i < files.length; i++) {
      if (currentCount + i >= maxImages) break
      const file = files[i]
      try {
        await addImageFromFile(file)
      } catch (err) {
        console.error('Failed to add image:', err)
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [videoMode, inputImages.length])

  const handleRemoveImage = useCallback((idx: number) => {
    removeInputImage(idx)
  }, [removeInputImage])

  const handleSubmit = useCallback(async () => {
    const trimmed = prompt.trim()
    if (!trimmed) {
      showToast('请输入提示词', 'error')
      return
    }

    const profile = getActiveVideoProfile({ videoProfiles, activeVideoProfileId } as any)
    if (!profile || !profile.apiKey) {
      showToast('请先完善视频 API 配置', 'error')
      setShowSettings(true, 'video')
      return
    }

    dismissAllTooltips()
    setSubmitting(true)
    try {
      await submitTask()
    } finally {
      setSubmitting(false)
    }
  }, [prompt, videoProfiles, activeVideoProfileId, setShowSettings, showToast])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void handleSubmit()
    }
  }, [handleSubmit])

  const hasImages = inputImages.length > 0
  const maxImages = MAX_IMAGES[videoMode]
  const canUploadMore = inputImages.length < maxImages

  const modePlaceholder: Record<VideoMode, string> = {
    text: '描述你想生成的视频...',
    'first-frame': '描述视频效果...',
    'first-last-frame': '描述首帧到尾帧的过渡效果...',
  }

  const frameLabel = (idx: number) => {
    if (videoMode === 'first-last-frame') {
      return idx === 0 ? '首帧' : '尾帧'
    }
    return '首帧'
  }

  return (
    <div data-video-input-bar className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-4xl px-3 sm:px-4 transition-all duration-300">
      <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl border border-white/50 dark:border-white/[0.08] shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] rounded-2xl sm:rounded-3xl p-3 sm:p-4 ring-1 ring-black/5 dark:ring-white/10">
        {/* Mode selector tabs */}
        <div className="mb-2 flex items-center gap-1.5">
          <div className="flex items-center gap-0 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-gray-100/70 dark:bg-white/[0.04] p-0.5">
            {MODES.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setVideoMode(mode)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  videoMode === mode
                    ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {videoMode !== 'text' && (
            <span className="text-xs text-gray-400">
              已上传 {inputImages.length}/{maxImages} 张
            </span>
          )}
        </div>

        {/* Reference images */}
        {hasImages && (
          <div className="mb-2 flex gap-2">
            {inputImages.map((img, idx) => (
              <div key={img.id} className="relative group">
                <div className="absolute -top-4 left-0 text-[10px] text-gray-400 dark:text-gray-500">
                  {frameLabel(idx)}
                </div>
                <div className="h-12 w-12 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10">
                  <img src={img.dataUrl} alt="" className="h-full w-full object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveImage(idx)}
                  className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none"
                  title="移除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-2">
          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={modePlaceholder[videoMode]}
              rows={1}
              className="w-full resize-none rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:placeholder-gray-500 dark:focus:border-blue-500/50"
              style={{ maxHeight: '200px' }}
            />
          </div>

          {/* Add image button */}
          {canUploadMore && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 rounded-xl border border-gray-200/70 bg-white/60 p-2.5 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
              title="添加参考图"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          )}

          {/* Submit button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="shrink-0 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '提交中' : '生成'}
          </button>
        </div>

        {/* Params row */}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <VideoParamsSelector
            params={videoParams}
            onChange={setVideoParams}
            disabled={submitting}
          />

          {/* Video profile selector */}
          {videoProfiles.length > 0 && (
            <div className="ml-2">
              <Select
                value={activeVideoProfileId}
                onChange={(id) => setActiveVideoProfileId(id)}
                options={videoProfiles.map((p) => ({ label: p.name || p.id, value: p.id }))}
                disabled={submitting}
                className="rounded-lg border border-gray-200/70 bg-white/60 px-2.5 py-2 text-xs text-gray-600 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-400 dark:focus:border-blue-500/50"
              />
            </div>
          )}

          {/* Settings button */}
          <button
            type="button"
            onClick={() => setShowSettings(true, 'video')}
            className="ml-auto text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            视频配置
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple={videoMode === 'first-last-frame'}
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    </div>
  )
}
