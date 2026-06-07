import { useRef, useEffect, useState, useCallback } from 'react'
import { useStore, submitTask, addImageFromFile, createInputImageFromFile } from '../store'
import { getActiveVideoProfile } from '../lib/apiProfiles'
import VideoParamsSelector, { getModelCapsFor } from './VideoParamsSelector'
import { dismissAllTooltips } from '../lib/tooltipDismiss'
import Select from './Select'
import type { VideoMode, VideoReference, AudioReference } from '../types'

const MODES: { mode: VideoMode; label: string; icon: string }[] = [
  { mode: 'multi', label: '多模态', icon: 'multi' },
  { mode: 'image', label: '图生视频', icon: 'image' },
  { mode: 'text', label: '文生视频', icon: 'text' },
]

const MODEL_VIDEO_CAPS: Record<string, { multiMode?: boolean }> = {
  'seedance-2.0-260128': { multiMode: true },
  'seedance-2.0-fast-260128': { multiMode: true },
  'seedance-1.5-pro': { multiMode: false },
}

const MAX_VIDEOS = 3
const MAX_AUDIOS = 3
const MAX_TOTAL_DURATION = 15

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
  const moveInputImage = useStore((s) => s.moveInputImage)
  const replaceInputImage = useStore((s) => s.replaceInputImage)
  const referenceVideos = useStore((s) => s.referenceVideos)
  const referenceAudios = useStore((s) => s.referenceAudios)
  const addVideoFromFile = useStore((s) => s.addVideoFromFile)
  const removeVideoReference = useStore((s) => s.removeVideoReference)
  const addAudioFromFile = useStore((s) => s.addAudioFromFile)
  const removeAudioReference = useStore((s) => s.removeAudioReference)
  const moveVideoReference = useStore((s) => s.moveVideoReference)
  const moveAudioReference = useStore((s) => s.moveAudioReference)
  const showSettings = useStore((s) => s.showSettings)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const showToast = useStore((s) => s.showToast)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const setSettings = useStore((s) => s.setSettings)
  const settings = useStore((s) => s.settings)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const imageFileInputRef = useRef<HTMLInputElement>(null)
  const replaceFileInputRef = useRef<HTMLInputElement>(null)
  const replaceVideoFileInputRef = useRef<HTMLInputElement>(null)
  const replaceAudioFileInputRef = useRef<HTMLInputElement>(null)
  const videoFileInputRef = useRef<HTMLInputElement>(null)
  const audioFileInputRef = useRef<HTMLInputElement>(null)
  const replaceImageTargetRef = useRef<{ index: number; id: string } | null>(null)
  const replaceVideoTargetRef = useRef<number | null>(null)
  const replaceAudioTargetRef = useRef<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Drag state for images
  const [imageDragIndex, setImageDragIndex] = useState<number | null>(null)
  const [imageDragOverIndex, setImageDragOverIndex] = useState<number | null>(null)
  const imageDragIndexRef = useRef<number | null>(null)
  const imageDragOverIndexRef = useRef<number | null>(null)

  // Drag state for videos
  const [videoDragIndex, setVideoDragIndex] = useState<number | null>(null)
  const [videoDragOverIndex, setVideoDragOverIndex] = useState<number | null>(null)
  const videoDragIndexRef = useRef<number | null>(null)
  const videoDragOverIndexRef = useRef<number | null>(null)

  // Drag state for audios
  const [audioDragIndex, setAudioDragIndex] = useState<number | null>(null)
  const [audioDragOverIndex, setAudioDragOverIndex] = useState<number | null>(null)
  const audioDragIndexRef = useRef<number | null>(null)
  const audioDragOverIndexRef = useRef<number | null>(null)

  const resetImageDrag = useCallback(() => {
    setImageDragIndex(null)
    setImageDragOverIndex(null)
    imageDragIndexRef.current = null
    imageDragOverIndexRef.current = null
  }, [])

  const resetVideoDrag = useCallback(() => {
    setVideoDragIndex(null)
    setVideoDragOverIndex(null)
    videoDragIndexRef.current = null
    videoDragOverIndexRef.current = null
  }, [])

  const resetAudioDrag = useCallback(() => {
    setAudioDragIndex(null)
    setAudioDragOverIndex(null)
    audioDragIndexRef.current = null
    audioDragOverIndexRef.current = null
  }, [])

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [prompt])

  // 根据当前模型获取能力
  const currentModel = videoParams.model || 'seedance-2.0-260128'
  const modelCaps = getModelCapsFor(currentModel)
  const maxImages = modelCaps.maxImages ?? 9
  const textModeAvailable = modelCaps.textMode !== false
  const imageModeAvailable = modelCaps.imageMode !== false
  const multiModeAvailable = MODEL_VIDEO_CAPS[currentModel]?.multiMode !== false

  // 过滤可用模式
  const availableModes = MODES.filter(({ mode }) => {
    if (mode === 'text') return textModeAvailable
    if (mode === 'image') return imageModeAvailable
    if (mode === 'multi') return multiModeAvailable
    return true
  })

  const isMultiMode = videoMode === 'multi'
  const isImageMode = videoMode === 'image'

  // 图生视频也支持最多 9 张（1张=首帧，2张=首尾帧，3+张=多图参考）
  const effectiveMaxImages = maxImages

  const handleImageFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const currentCount = inputImages.length
    for (let i = 0; i < files.length; i++) {
      if (currentCount + i >= effectiveMaxImages) break
      const file = files[i]
      try {
        await addImageFromFile(file)
      } catch (err) {
        console.error('Failed to add image:', err)
      }
    }
    if (imageFileInputRef.current) imageFileInputRef.current.value = ''
  }, [inputImages.length, effectiveMaxImages, addImageFromFile])

  const handleVideoFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    for (let i = 0; i < files.length; i++) {
      if (referenceVideos.length + i >= MAX_VIDEOS) break
      try {
        await addVideoFromFile(files[i])
      } catch (err) {
        console.error('Failed to add video:', err)
      }
    }
    if (videoFileInputRef.current) videoFileInputRef.current.value = ''
  }, [referenceVideos.length, addVideoFromFile])

  const handleAudioFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    for (let i = 0; i < files.length; i++) {
      if (referenceAudios.length + i >= MAX_AUDIOS) break
      try {
        await addAudioFromFile(files[i])
      } catch (err) {
        console.error('Failed to add audio:', err)
      }
    }
    if (audioFileInputRef.current) audioFileInputRef.current.value = ''
  }, [referenceAudios.length, addAudioFromFile])

  const handleRemoveImage = useCallback((idx: number) => {
    removeInputImage(idx)
  }, [removeInputImage])

  const handleEditReferenceImage = useCallback((img: { id: string; dataUrl: string }, idx: number) => {
    if (settings.referenceImageEditAction === 'replace-reference') {
      replaceImageTargetRef.current = { index: idx, id: img.id }
      replaceFileInputRef.current?.click()
      return
    }

    setConfirmDialog({
      title: '编辑参考图',
      message: '请选择要执行的操作。若不勾选下方的选项，则每次都询问；勾选后可在 **设置-习惯配置** 修改选择。',
      checkbox: { label: '以后默认执行此选择' },
      buttons: [
        {
          label: '替换参考图',
          tone: 'secondary',
          action: (remember) => {
            if (remember) setSettings({ referenceImageEditAction: 'replace-reference' })
            replaceImageTargetRef.current = { index: idx, id: img.id }
            replaceFileInputRef.current?.click()
          },
        },
      ],
    })
  }, [settings.referenceImageEditAction, setConfirmDialog, setSettings])

  const handleReplaceFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length || !replaceImageTargetRef.current) return
    const target = replaceImageTargetRef.current
    const file = files[0]
    const img = await createInputImageFromFile(file)
    if (img) {
      replaceInputImage(target.index, img)
    }
    replaceImageTargetRef.current = null
    if (replaceFileInputRef.current) replaceFileInputRef.current.value = ''
  }, [replaceInputImage])

  const handleReplaceVideoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length || replaceVideoTargetRef.current === null) return
    const idx = replaceVideoTargetRef.current
    const file = files[0]
    removeVideoReference(idx)
    await addVideoFromFile(file)
    replaceVideoTargetRef.current = null
    if (replaceVideoFileInputRef.current) replaceVideoFileInputRef.current.value = ''
  }, [addVideoFromFile, removeVideoReference])

  const handleReplaceAudioSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length || replaceAudioTargetRef.current === null) return
    const idx = replaceAudioTargetRef.current
    const file = files[0]
    removeAudioReference(idx)
    await addAudioFromFile(file)
    replaceAudioTargetRef.current = null
    if (replaceAudioFileInputRef.current) replaceAudioFileInputRef.current.value = ''
  }, [addAudioFromFile, removeAudioReference])

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

  // Image mode labels
  const hasImages = inputImages.length > 0
  const canUploadMoreImages = inputImages.length < effectiveMaxImages

  const frameLabel = (idx: number) => {
    if (isMultiMode) return `图${idx + 1}`
    if (inputImages.length === 1) return '首帧'
    if (inputImages.length === 2) return idx === 0 ? '首帧' : '尾帧'
    return `图${idx + 1}`
  }

  // 图生视频模式下的帧角色标记
  const frameBadge = (idx: number) => {
    if (!isImageMode) return null
    if (inputImages.length === 1) return '首帧'
    if (inputImages.length === 2) return idx === 0 ? '首帧' : '尾帧'
    return null
  }

  // Image drag handlers
  const handleImageDragStart = (e: React.DragEvent, idx: number) => {
    imageDragIndexRef.current = idx
    setImageDragIndex(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
    const thumb = e.currentTarget as HTMLElement
    const preview = thumb.cloneNode(true) as HTMLElement
    preview.style.cssText = 'position:fixed;left:-1000px;top:-1000px;width:52px;height:52px;border-radius:8px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.25);'
    document.body.appendChild(preview)
    e.dataTransfer.setDragImage(preview, 26, 26)
    setTimeout(() => document.body.removeChild(preview), 0)
  }

  const handleImageDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const fromIdx = imageDragIndexRef.current
    if (fromIdx === null || fromIdx === idx) return
    const rect = e.currentTarget.getBoundingClientRect()
    setImageDragOverIndex(e.clientX < rect.left + rect.width / 2 ? idx : idx + 1)
    imageDragOverIndexRef.current = e.clientX < rect.left + rect.width / 2 ? idx : idx + 1
  }

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const fromIdx = imageDragIndexRef.current
    const toIdx = imageDragOverIndexRef.current
    if (fromIdx !== null && toIdx !== null && fromIdx !== toIdx) {
      moveInputImage(fromIdx, toIdx)
    }
    resetImageDrag()
  }

  // Video drag handlers
  const handleVideoDragStart = (e: React.DragEvent, idx: number) => {
    videoDragIndexRef.current = idx
    setVideoDragIndex(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }

  const handleVideoDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const fromIdx = videoDragIndexRef.current
    if (fromIdx === null || fromIdx === idx) return
    const rect = e.currentTarget.getBoundingClientRect()
    setVideoDragOverIndex(e.clientX < rect.left + rect.width / 2 ? idx : idx + 1)
    videoDragOverIndexRef.current = e.clientX < rect.left + rect.width / 2 ? idx : idx + 1
  }

  const handleVideoDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const fromIdx = videoDragIndexRef.current
    const toIdx = videoDragOverIndexRef.current
    if (fromIdx !== null && toIdx !== null && fromIdx !== toIdx) {
      moveVideoReference(fromIdx, toIdx)
    }
    resetVideoDrag()
  }

  // Audio drag handlers
  const handleAudioDragStart = (e: React.DragEvent, idx: number) => {
    audioDragIndexRef.current = idx
    setAudioDragIndex(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }

  const handleAudioDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const fromIdx = audioDragIndexRef.current
    if (fromIdx === null || fromIdx === idx) return
    const rect = e.currentTarget.getBoundingClientRect()
    setAudioDragOverIndex(e.clientX < rect.left + rect.width / 2 ? idx : idx + 1)
    audioDragOverIndexRef.current = e.clientX < rect.left + rect.width / 2 ? idx : idx + 1
  }

  const handleAudioDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const fromIdx = audioDragIndexRef.current
    const toIdx = audioDragOverIndexRef.current
    if (fromIdx !== null && toIdx !== null && fromIdx !== toIdx) {
      moveAudioReference(fromIdx, toIdx)
    }
    resetAudioDrag()
  }

  const videoTotalDuration = referenceVideos.reduce((s, v) => s + v.duration, 0)
  const audioTotalDuration = referenceAudios.reduce((s, a) => s + a.duration, 0)

  const placeholder = videoMode === 'text'
    ? '描述你想生成的视频...'
    : videoMode === 'image'
      ? inputImages.length === 0
        ? '上传参考图后，描述你想要的视频效果...'
        : inputImages.length === 1
          ? '描述首帧到视频的过渡效果...'
          : '描述首帧到尾帧的过渡效果...'
      : inputImages.length === 0 && referenceVideos.length === 0 && referenceAudios.length === 0
        ? '上传参考素材后，描述你想要的视频效果...'
        : '描述参考素材的组合效果...'

  return (
    <div data-video-input-bar className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-4xl px-3 sm:px-4 transition-all duration-300">
      <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl border border-white/50 dark:border-white/[0.08] shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] rounded-2xl sm:rounded-3xl p-3 sm:p-4 ring-1 ring-black/5 dark:ring-white/10">
        {/* Mode selector tabs */}
        <div className="mb-3 flex items-center gap-2">
          {availableModes.length > 1 && (
            <div className="flex items-center gap-0 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-gray-100/70 dark:bg-white/[0.04] p-0.5">
              {availableModes.map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setVideoMode(mode)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    videoMode === mode
                      ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {/* Image count indicator */}
          {(isImageMode || isMultiMode) && (
            <span className="text-xs text-gray-400">
              {isImageMode && hasImages
                ? `已上传 ${inputImages.length}/${effectiveMaxImages} 张`
                : isMultiMode && (inputImages.length > 0 || referenceVideos.length > 0 || referenceAudios.length > 0)
                  ? `图片 ${inputImages.length}/${maxImages} · 视频 ${referenceVideos.length}/${MAX_VIDEOS} · 音频 ${referenceAudios.length}/${MAX_AUDIOS}`
                  : isImageMode
                    ? `上传参考图（最多 ${effectiveMaxImages} 张）`
                    : `上传参考素材`}
            </span>
          )}
        </div>

        {/* Reference images - always show in image/multi modes */}
        {(isImageMode || isMultiMode) && (
          <div className="mb-2">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {inputImages.map((img, idx) => {
                const isDragging = imageDragIndex === idx
                const isLast = idx === inputImages.length - 1
                const showDropBefore = imageDragOverIndex === idx && imageDragIndex !== idx
                const showDropAfter = imageDragOverIndex === inputImages.length && isLast && imageDragIndex !== idx
                return (
                  <div
                    key={img.id}
                    className="relative group shrink-0"
                    draggable
                    onDragStart={(e) => handleImageDragStart(e, idx)}
                    onDragOver={(e) => handleImageDragOver(e, idx)}
                    onDrop={handleImageDrop}
                    onDragEnd={resetImageDrag}
                  >
                    {showDropBefore && (
                      <div className="absolute -left-[3px] top-0 bottom-0 w-[2px] bg-blue-500 rounded-full z-40 shadow-sm pointer-events-none" />
                    )}
                    {showDropAfter && (
                      <div className="absolute -right-[3px] top-0 bottom-0 w-[2px] bg-blue-500 rounded-full z-40 shadow-sm pointer-events-none" />
                    )}
                    <div className={`relative h-[52px] w-[52px] rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 shadow-sm transition-opacity ${isDragging ? 'opacity-40' : ''}`}>
                      <img src={img.dataUrl} alt="" className="h-full w-full object-cover cursor-grab active:cursor-grabbing pointer-events-none" />
                      {/* 序号角标 */}
                      <span className="absolute bottom-1 left-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/55 text-[9px] font-semibold text-white backdrop-blur-sm z-10 pointer-events-none">
                        {idx + 1}
                      </span>
                      {/* 图生视频模式：首帧/尾帧 角标（右上角） */}
                      {frameBadge(idx) && (
                        <span className={`absolute top-1 right-1 rounded px-1.5 py-0.5 text-[9px] font-bold text-white leading-none shadow-sm z-10 pointer-events-none ${
                          frameBadge(idx) === '首帧' ? 'bg-blue-500' : 'bg-amber-500'
                        }`}>
                          {frameBadge(idx)}
                        </span>
                      )}
                      {/* 编辑按钮 */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditReferenceImage(img, idx)
                        }}
                        className="absolute inset-0 w-full h-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer z-20 focus:outline-none border-none"
                        title="编辑"
                      >
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none shadow-md hover:bg-red-600 z-30"
                      title="移除"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )
              })}
              {canUploadMoreImages && (
                <button
                  type="button"
                  onClick={() => imageFileInputRef.current?.click()}
                  className="shrink-0 h-[52px] w-[52px] rounded-lg border border-dashed border-gray-300 dark:border-white/[0.12] flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:border-gray-400 dark:hover:border-white/[0.2] transition-colors"
                  title="添加图片"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Multi mode: video references - always show */}
        {isMultiMode && (
          <div className="mb-2">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {referenceVideos.map((vid, idx) => {
                const isDragging = videoDragIndex === idx
                const isLast = idx === referenceVideos.length - 1
                const showDropBefore = videoDragOverIndex === idx && videoDragIndex !== idx
                const showDropAfter = videoDragOverIndex === referenceVideos.length && isLast && videoDragIndex !== idx
                return (
                  <div
                    key={vid.id}
                    className="relative group shrink-0"
                    draggable
                    onDragStart={(e) => handleVideoDragStart(e, idx)}
                    onDragOver={(e) => handleVideoDragOver(e, idx)}
                    onDrop={handleVideoDrop}
                    onDragEnd={resetVideoDrag}
                  >
                    {showDropBefore && (
                      <div className="absolute -left-[3px] top-0 bottom-0 w-[2px] bg-blue-500 rounded-full z-40 shadow-sm pointer-events-none" />
                    )}
                    {showDropAfter && (
                      <div className="absolute -right-[3px] top-0 bottom-0 w-[2px] bg-blue-500 rounded-full z-40 shadow-sm pointer-events-none" />
                    )}
                    <div className="relative group/video">
                      <div className={`h-20 w-28 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5 flex items-center justify-center transition-opacity ${isDragging ? 'opacity-40' : ''}`}>
                        {vid.thumbnailDataUrl ? (
                          <img src={vid.thumbnailDataUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9.75M4.5 5.25h9.75" />
                          </svg>
                        )}
                      </div>
                      <span className="absolute bottom-0.5 right-0.5 text-[9px] text-white bg-black/60 rounded px-1 leading-tight">
                        {vid.duration.toFixed(1)}s
                      </span>
                      {/* 编辑按钮 */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          replaceVideoTargetRef.current = idx
                          replaceVideoFileInputRef.current?.click()
                        }}
                        className="absolute inset-0 w-full h-full bg-black/40 opacity-0 group-hover/video:opacity-100 transition-opacity flex items-center justify-center cursor-pointer z-20 focus:outline-none border-none"
                        title="替换"
                      >
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                    <span className="absolute -top-4 left-0 text-[10px] text-gray-400 dark:text-gray-500">视频{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeVideoReference(idx)}
                      className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none"
                      title="移除"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
              {referenceVideos.length < MAX_VIDEOS && videoTotalDuration < MAX_TOTAL_DURATION && (
                <button
                  type="button"
                  onClick={() => videoFileInputRef.current?.click()}
                  className="shrink-0 h-20 w-28 rounded-lg border border-dashed border-gray-300 dark:border-white/[0.12] flex flex-col items-center justify-center gap-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:border-gray-400 dark:hover:border-white/[0.2] transition-colors"
                  title="添加视频"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  {referenceVideos.length === 0 && <span className="text-[10px]">视频</span>}
                </button>
              )}
            </div>
            {(referenceVideos.length > 0 || referenceAudios.length > 0) && (
              <div className="text-[10px] text-gray-400 mt-0.5">
                视频总时长 {videoTotalDuration.toFixed(1)}s / {MAX_TOTAL_DURATION}s
              </div>
            )}
          </div>
        )}

        {/* Multi mode: audio references - always show */}
        {isMultiMode && (
          <div className="mb-2">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {referenceAudios.map((aud, idx) => {
                const isDragging = audioDragIndex === idx
                const isLast = idx === referenceAudios.length - 1
                const showDropBefore = audioDragOverIndex === idx && audioDragIndex !== idx
                const showDropAfter = audioDragOverIndex === referenceAudios.length && isLast && audioDragIndex !== idx
                return (
                  <div
                    key={aud.id}
                    className="relative group shrink-0"
                    draggable
                    onDragStart={(e) => handleAudioDragStart(e, idx)}
                    onDragOver={(e) => handleAudioDragOver(e, idx)}
                    onDrop={handleAudioDrop}
                    onDragEnd={resetAudioDrag}
                  >
                    {showDropBefore && (
                      <div className="absolute -left-[3px] top-0 bottom-0 w-[2px] bg-blue-500 rounded-full z-40 shadow-sm pointer-events-none" />
                    )}
                    {showDropAfter && (
                      <div className="absolute -right-[3px] top-0 bottom-0 w-[2px] bg-blue-500 rounded-full z-40 shadow-sm pointer-events-none" />
                    )}
                    <div className={`relative h-14 w-36 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex items-center gap-2 px-2 transition-opacity ${isDragging ? 'opacity-40' : ''}`}>
                      <svg className="h-5 w-5 text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{aud.fileName}</div>
                        <div className="text-[10px] text-gray-400">{aud.duration.toFixed(1)}s</div>
                      </div>
                      {/* 编辑按钮 */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          replaceAudioTargetRef.current = idx
                          replaceAudioFileInputRef.current?.click()
                        }}
                        className="absolute inset-0 w-full h-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer z-20 focus:outline-none border-none"
                        title="替换"
                      >
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAudioReference(idx)}
                      className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none"
                      title="移除"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
              {referenceAudios.length < MAX_AUDIOS && audioTotalDuration < MAX_TOTAL_DURATION && (
                <button
                  type="button"
                  onClick={() => audioFileInputRef.current?.click()}
                  className="shrink-0 h-12 w-32 rounded-lg border border-dashed border-gray-300 dark:border-white/[0.12] flex flex-col items-center justify-center gap-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:border-gray-400 dark:hover:border-white/[0.2] transition-colors text-xs"
                  title="添加音频"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  {referenceAudios.length === 0 && <span className="text-[10px]">音频</span>}
                </button>
              )}
            </div>
            {(referenceVideos.length > 0 || referenceAudios.length > 0) && (
              <div className="text-[10px] text-gray-400 mt-0.5">
                音频总时长 {audioTotalDuration.toFixed(1)}s / {MAX_TOTAL_DURATION}s
              </div>
            )}
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
              placeholder={placeholder}
              rows={1}
              className="w-full resize-none rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:placeholder-gray-500 dark:focus:border-blue-500/50"
              style={{ maxHeight: '200px' }}
            />
          </div>

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

        {/* Hidden file inputs */}
        <input
          ref={imageFileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImageFileSelect}
        />
        {/* 替换图片的隐藏输入 */}
        <input
          ref={replaceFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleReplaceFileSelect}
        />
        <input
          ref={videoFileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,.mp4,.mov"
          multiple
          className="hidden"
          onChange={handleVideoFileSelect}
        />
        <input
          ref={audioFileInputRef}
          type="file"
          accept="audio/mpeg,audio/wav,.mp3,.wav"
          multiple
          className="hidden"
          onChange={handleAudioFileSelect}
        />
        {/* 替换视频的隐藏输入 */}
        <input
          ref={replaceVideoFileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,.mp4,.mov"
          className="hidden"
          onChange={handleReplaceVideoSelect}
        />
        {/* 替换音频的隐藏输入 */}
        <input
          ref={replaceAudioFileInputRef}
          type="file"
          accept="audio/mpeg,audio/wav,.mp3,.wav"
          className="hidden"
          onChange={handleReplaceAudioSelect}
        />
      </div>
    </div>
  )
}
