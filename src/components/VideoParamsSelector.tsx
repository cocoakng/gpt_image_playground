import { useState, useRef, useEffect } from 'react'
import type { VideoParams } from '../types'

const MODEL_OPTIONS = [
  { label: 'Seedance 2.0', value: 'seedance-2.0-260128' },
  { label: 'Seedance 2.0 快速', value: 'seedance-2.0-fast-260128' },
  { label: 'Seedance 1.5 Pro', value: 'seedance-1.5-pro' },
]

const DEFAULT_MODEL = 'seedance-2.0-260128'

/** 各模型支持的配置项 */
const VIDEO_MODEL_CAPS: Record<string, {
  resolution?: boolean
  duration?: boolean
  ratio?: boolean
  watermark?: boolean
  generateAudio?: boolean
  cameraFixed?: boolean
  returnLastFrame?: boolean
  seed?: boolean
  /** 支持文生视频 */
  textMode?: boolean
  /** 支持图生视频 */
  imageMode?: boolean
  /** 图生视频最多上传几张 */
  maxImages?: number
}> = {
  'seedance-2.0-260128': {
    resolution: true, duration: true, ratio: true,
    watermark: true, generateAudio: true, cameraFixed: true,
    returnLastFrame: true, seed: true,
    textMode: true, imageMode: true, maxImages: 9,
  },
  'seedance-2.0-fast-260128': {
    resolution: true, duration: true, ratio: true,
    watermark: true, generateAudio: true, cameraFixed: true,
    returnLastFrame: true, seed: true,
    textMode: true, imageMode: true, maxImages: 9,
  },
  'seedance-1.5-pro': {
    resolution: true, duration: true, ratio: true,
    watermark: true, generateAudio: false, cameraFixed: false,
    returnLastFrame: true, seed: true,
    textMode: true, imageMode: true, maxImages: 9,
  },
}

/** 获取模型能力 */
export function getModelCapsFor(model: string) {
  return VIDEO_MODEL_CAPS[model] ?? VIDEO_MODEL_CAPS[DEFAULT_MODEL]!
}

interface VideoParamsSelectorProps {
  params: VideoParams
  onChange: (params: VideoParams) => void
  disabled?: boolean
}

const RATIO_OPTIONS = [
  { label: '16:9', value: '16:9', icon: 'wide' },
  { label: '9:16', value: '9:16', icon: 'tall' },
  { label: '1:1', value: '1:1', icon: 'square' },
  { label: '4:3', value: '4:3', icon: 'land' },
  { label: '3:4', value: '3:4', icon: 'port' },
  { label: '21:9', value: '21:9', icon: 'ultrawide' },
  { label: 'adaptive', value: 'adaptive', icon: 'auto' },
]

const RATIO_ICON_SHAPES: Record<string, { w: number; h: number }> = {
  wide: { w: 16, h: 9 },
  tall: { w: 9, h: 16 },
  square: { w: 12, h: 12 },
  land: { w: 14, h: 10 },
  port: { w: 10, h: 14 },
  ultrawide: { w: 21, h: 9 },
  auto: { w: 14, h: 10 },
}

const RESOLUTION_OPTIONS = [
  { label: '480p', value: '480p' },
  { label: '720p', value: '720p' },
  { label: '1080p', value: '1080p', pro: true },
]

const DURATION_MIN = 4
const DURATION_MAX = 15
const DURATION_STEPS = [4, 5, 10, 15]

export default function VideoParamsSelector({ params, onChange, disabled }: VideoParamsSelectorProps) {
  const update = (key: keyof VideoParams, value: VideoParams[keyof VideoParams]) => {
    onChange({ ...params, [key]: value })
  }

  // 切换模型时，重置不支持的参数
  const handleModelChange = (value: string) => {
    const newCaps = VIDEO_MODEL_CAPS[value] ?? {}
    const resetParams: Partial<VideoParams> = {}
    if (!newCaps.generateAudio) resetParams.generateAudio = undefined
    if (!newCaps.cameraFixed) resetParams.cameraFixed = undefined
    if (!newCaps.returnLastFrame) resetParams.returnLastFrame = undefined
    if (!newCaps.watermark) resetParams.watermark = undefined
    onChange({ ...params, model: value, ...resetParams })
  }

  const currentModelCaps = VIDEO_MODEL_CAPS[params.model || DEFAULT_MODEL] ?? VIDEO_MODEL_CAPS[DEFAULT_MODEL]!

  const [expanded, setExpanded] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // 点击外部收起面板
  useEffect(() => {
    if (!expanded) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [expanded])

  // 摘要文字
  const ratioLabel = params.ratio === 'adaptive' ? '自适应' : params.ratio
  const durationLabel = `${params.duration}s`
  const resolutionLabel = params.resolution
  const hasAudio = params.generateAudio

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* 模型选择器 */}
      <select
        value={params.model || DEFAULT_MODEL}
        onChange={(e) => handleModelChange(e.target.value)}
        disabled={disabled}
        className="rounded-full border border-gray-300 dark:border-white/[0.12] bg-white/60 dark:bg-white/[0.04] px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 outline-none appearance-none pr-8"
      >
        {MODEL_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* 配置胶囊 - 相对定位容器 */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 rounded-full border border-gray-300 dark:border-white/[0.12] bg-white/60 dark:bg-white/[0.04] px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 outline-none transition hover:bg-white/80 dark:hover:bg-white/[0.08]"
        >
        {/* 比例图标 */}
        <RatioIcon shape={RATIO_ICON_SHAPES[params.ratio] || RATIO_ICON_SHAPES.wide} />
        <span>{ratioLabel}</span>
        <span className="text-gray-400">|</span>
        {/* 时长 */}
        <svg className="h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        <span>{durationLabel}</span>
        <span className="text-gray-400">|</span>
        {/* 分辨率 */}
        <svg className="h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
        <span>{resolutionLabel}</span>
        {currentModelCaps.generateAudio && (
          <>
            <span className="text-gray-400">|</span>
            <svg className="h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            <span>{hasAudio ? '开启' : '关闭'}</span>
          </>
        )}
        {/* 下拉箭头 */}
        <svg
          className={`h-3.5 w-3.5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* 展开面板 */}
      {expanded && (
        <div ref={panelRef} className="absolute z-50 bottom-full mb-2 min-w-[320px] rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1e2e] p-5 shadow-xl">
          {/* 比例 */}
          {currentModelCaps.ratio && (
            <div className="mb-5">
              <h4 className="mb-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                画面比例
              </h4>
              <div className="grid grid-cols-4 gap-2">
                {RATIO_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => update('ratio', opt.value)}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-lg p-2.5 text-xs transition ${
                      params.ratio === opt.value
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <RatioIcon shape={RATIO_ICON_SHAPES[opt.icon]} active={params.ratio === opt.value} />
                    <span>{opt.value === 'adaptive' ? '自适应' : opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 时长 */}
          {currentModelCaps.duration && (
            <div className="mb-5">
              <h4 className="mb-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                时长
              </h4>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600 dark:text-gray-300 w-8 text-right">{DURATION_MIN}s</span>
                <input
                  type="range"
                  min={DURATION_MIN}
                  max={DURATION_MAX}
                  step={1}
                  value={params.duration}
                  onChange={(e) => update('duration', Number(e.target.value))}
                  disabled={disabled}
                  className="flex-1 h-2 rounded-full appearance-none bg-gray-200 dark:bg-white/[0.1] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <span className="text-sm text-gray-600 dark:text-gray-300 w-8">{DURATION_MAX}s</span>
              </div>
              <div className="flex justify-between mt-1 px-1">
                {DURATION_STEPS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={disabled}
                    onClick={() => update('duration', s)}
                    className={`text-xs px-2 py-0.5 rounded transition ${
                      params.duration === s
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    {s}s
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 分辨率 */}
          {currentModelCaps.resolution && (
            <div className="mb-5">
              <h4 className="mb-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                分辨率
              </h4>
              <div className="flex gap-2">
                {RESOLUTION_OPTIONS.map((opt) => {
                  const isDisabled = opt.pro && params.model === 'seedance-2.0-fast-260128'
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={disabled || isDisabled}
                      onClick={() => update('resolution', opt.value as VideoParams['resolution'])}
                      className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm transition ${
                        params.resolution === opt.value
                          ? 'bg-blue-500 text-white'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06]'
                      } ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      {opt.label}
                      {opt.pro && (
                        <span className={`text-[10px] ${params.resolution === opt.value ? 'text-yellow-200' : 'text-yellow-500'}`}>Pro</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 音画 */}
          {currentModelCaps.generateAudio && (
            <div className="mb-5">
              <h4 className="mb-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                音频
              </h4>
              <div className="flex gap-2">
                {(['开启', '关闭'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    disabled={disabled}
                    onClick={() => update('generateAudio', v === '开启')}
                    className={`rounded-lg px-4 py-2 text-sm transition ${
                      (v === '开启') === params.generateAudio
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 高级选项 */}
          {currentModelCaps.seed && (
            <div className="mb-3">
              <details className="group">
                <summary className="cursor-pointer text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                  高级选项
                </summary>
                <div className="mt-3 space-y-3">
                  {currentModelCaps.watermark && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">水印</span>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => update('watermark', !params.watermark)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${params.watermark ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                      >
                        <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${params.watermark ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  )}
                  {currentModelCaps.cameraFixed && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">固定镜头</span>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => update('cameraFixed', !params.cameraFixed)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${params.cameraFixed ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                      >
                        <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${params.cameraFixed ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  )}
                  {currentModelCaps.returnLastFrame && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">返回尾帧</span>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => update('returnLastFrame', !params.returnLastFrame)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${params.returnLastFrame ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                      >
                        <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${params.returnLastFrame ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  )}
                  {currentModelCaps.seed && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">随机种子</span>
                      <input
                        type="number"
                        min={1}
                        value={params.seed ?? ''}
                        onChange={(e) => update('seed', e.target.value ? Number(e.target.value) : undefined)}
                        placeholder="留空随机"
                        disabled={disabled}
                        className="w-24 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.03] px-2 py-1 text-sm text-gray-700 dark:text-gray-200 outline-none"
                      />
                    </div>
                  )}
                </div>
              </details>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  )
}

function RatioIcon({ shape, active }: { shape: { w: number; h: number }; active?: boolean }) {
  const max = 24
  const scale = Math.min(max / shape.w, max / shape.h) * 0.7
  return (
    <svg
      className={active ? 'text-white' : 'text-current'}
      width={shape.w * scale}
      height={shape.h * scale}
      viewBox={`0 0 ${shape.w * scale} ${shape.h * scale}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect
        x="1"
        y="1"
        width={shape.w * scale - 2}
        height={shape.h * scale - 2}
        rx="2"
      />
    </svg>
  )
}
