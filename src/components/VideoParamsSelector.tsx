import { useState, useRef, useEffect } from 'react'
import type { VideoParams, VideoMode } from '../types'
import { ChevronDownIcon } from './icons'

const DEFAULT_MODEL = 'doubao-seedance-2-0-fast-260128'

/** 各模型支持的配置项 */
const VIDEO_MODEL_CAPS: Record<string, {
  label: string
  available?: boolean  // 模型是否可用，默认 true
  resolution?: string[]
  duration?: { min: number; max: number; step?: number; options?: number[] }
  ratio?: string[]
  audio?: boolean
  seed?: boolean
  mode?: string[]
  subModel?: string[]
  seconds?: number[]
  imageMode?: boolean
  maxImages?: number
  modes?: VideoMode[]
  frameMode?: 'start-end' | 'reference'
}> = {
  'kling-v3': {
    label: 'kling-v3',
    mode: ['std', 'pro'],
    duration: { min: 3, max: 15 },
    ratio: ['16:9', '9:16', '1:1'],
    audio: true,
    seed: false,
    imageMode: true,
    maxImages: 9,
    modes: ['text', 'image'],
    frameMode: 'start-end',
  },
  'viduq3': {
    label: 'viduq3',
    resolution: ['720p', '1080p'],
    duration: { min: 3, max: 16 },
    ratio: ['16:9', '9:16', '1:1'],
    audio: true,
    seed: true,
    imageMode: true,
    maxImages: 7,
    modes: ['text', 'image'],
    frameMode: 'start-end',
  },
  'grok-video-3': {
    label: 'grok-video-3',
    resolution: ['480p', '720p'],
    seconds: [6, 10, 15],
    ratio: ['16:9', '9:16', '3:2', '2:3', '1:1'],
    audio: false,
    seed: false,
    imageMode: true,
    maxImages: 3,
    modes: ['text', 'image'],
    frameMode: 'start-end',
  },
  'doubao-seedance-2-0-260128': {
    label: 'doubao-seedance-2-0-260128',
    duration: { min: 4, max: 15 },
    ratio: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
    audio: true,
    seed: false,
    imageMode: true,
    maxImages: 9,
    modes: ['text', 'image', 'multi'],
    frameMode: 'reference',
  },
  'doubao-seedance-2-0-fast-260128': {
    label: 'doubao-seedance-2-0-fast-260128',
    duration: { min: 4, max: 15 },
    ratio: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
    audio: true,
    seed: false,
    imageMode: true,
    maxImages: 9,
    modes: ['text', 'image', 'multi'],
    frameMode: 'reference',
  },
  'happyhorse-1.0': {
    label: 'happyhorse-1.0',
    duration: { min: 5, max: 15 },
    ratio: ['16:9', '9:16', '4:3', '3:4', '1:1'],
    audio: false,
    seed: false,
    imageMode: true,
    maxImages: 9,
    modes: ['text', 'image'],
    frameMode: 'reference',
  },
}

/** 模型选项，从 VIDEO_MODEL_CAPS 动态生成 */
export const MODEL_OPTIONS = Object.entries(VIDEO_MODEL_CAPS).map(([value, caps]) => ({
  label: caps.label,
  value,
  available: caps.available ?? true,
}))

/** 获取模型能力 */
export function getModelCapsFor(model: string) {
  return VIDEO_MODEL_CAPS[model] ?? VIDEO_MODEL_CAPS[DEFAULT_MODEL]!
}

interface VideoParamsSelectorProps {
  params: VideoParams
  onChange: (params: VideoParams) => void
  disabled?: boolean
  /** Hide the model selector dropdown, model comes from params only */
  hideModel?: boolean
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

const ALL_RESOLUTION_OPTIONS = [
  { label: '480p', value: '480p' },
  { label: '720p', value: '720p' },
  { label: '1080p', value: '1080p', pro: true },
]

export default function VideoParamsSelector({ params, onChange, disabled, hideModel }: VideoParamsSelectorProps) {
  const update = (key: keyof VideoParams, value: VideoParams[keyof VideoParams]) => {
    onChange({ ...params, [key]: value })
  }

  // 切换模型时，重置不支持的参数
  const handleModelChange = (value: string) => {
    const newCaps = VIDEO_MODEL_CAPS[value] ?? {}
    const resetParams: Partial<VideoParams> = {}
    if (!newCaps.audio) resetParams.generateAudio = undefined
    if (!newCaps.seed) resetParams.seed = undefined
    if (!newCaps.mode) resetParams.klingMode = undefined
    if (!newCaps.seconds) resetParams.grokSeconds = undefined
    if (!newCaps.resolution) resetParams.resolution = undefined
    onChange({ ...params, model: value, ...resetParams })
  }

  const currentModelCaps = VIDEO_MODEL_CAPS[params.model || DEFAULT_MODEL] ?? VIDEO_MODEL_CAPS[DEFAULT_MODEL]!

  // 当前模型支持的分辨率
  const supportedResolutions = currentModelCaps.resolution
    ? ALL_RESOLUTION_OPTIONS.filter(o => currentModelCaps.resolution!.includes(o.value))
    : ALL_RESOLUTION_OPTIONS

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

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* 模型选择器 */}
      {!hideModel && (
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={params.model || DEFAULT_MODEL}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={disabled}
              className="rounded-full border border-gray-300 dark:border-white/[0.12] bg-white/60 dark:bg-white/[0.04] pl-3 pr-8 py-1.5 text-sm text-gray-700 dark:text-gray-200 outline-none appearance-none transition hover:bg-white dark:hover:bg-white/[0.08] hover:border-gray-400 dark:hover:border-white/20 cursor-pointer disabled:cursor-not-allowed"
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={!opt.available}>
                  {opt.label}{!opt.available ? ' (维护中)' : ''}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
          </div>
          {/* 状态圆点 */}
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              currentModelCaps.available === false ? 'bg-red-400' : 'bg-green-400'
            }`}
            title={currentModelCaps.available === false ? '模型维护中' : '模型可用'}
          />
        </div>
      )}

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
        {(currentModelCaps.duration || currentModelCaps.seconds) && (
          <>
            <span className="text-gray-400">|</span>
            {/* 时长 */}
            <svg className="h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <span>{durationLabel}</span>
          </>
        )}
        {currentModelCaps.resolution && (
          <>
            <span className="text-gray-400">|</span>
            {/* 分辨率 */}
            <svg className="h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            <span>{resolutionLabel}</span>
          </>
        )}
        {currentModelCaps.audio && (
          <>
            <span className="text-gray-400">|</span>
            <svg className="h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            <span>{params.generateAudio ? '开启' : '关闭'}</span>
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
                {RATIO_OPTIONS.filter(o => currentModelCaps.ratio!.includes(o.value)).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => update('ratio', opt.value as VideoParams['ratio'])}
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

          {/* Kling 生成模式 */}
          {currentModelCaps.mode && (
            <div className="mb-5">
              <h4 className="mb-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                生成模式
              </h4>
              <div className="flex gap-2">
                {currentModelCaps.mode.map((m) => (
                  <button
                    key={m}
                    type="button"
                    disabled={disabled}
                    onClick={() => update('klingMode', m as 'std' | 'pro')}
                    className={`rounded-lg px-4 py-2 text-sm transition ${
                      params.klingMode === m
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    {m === 'std' ? '标准 (720p)' : '专业 (1080p)'}
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
                <span className="text-sm text-gray-600 dark:text-gray-300 w-8 text-right">{currentModelCaps.duration!.min}s</span>
                <input
                  type="range"
                  min={currentModelCaps.duration!.min}
                  max={currentModelCaps.duration!.max}
                  step={currentModelCaps.duration!.step || 1}
                  value={params.duration}
                  onChange={(e) => update('duration', Number(e.target.value))}
                  disabled={disabled}
                  className="flex-1 h-2 rounded-full appearance-none bg-gray-200 dark:bg-white/[0.1] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <span className="text-sm text-gray-600 dark:text-gray-300 w-8">{currentModelCaps.duration!.max}s</span>
              </div>
            </div>
          )}

          {/* Grok 固定时长 */}
          {currentModelCaps.seconds && (
            <div className="mb-5">
              <h4 className="mb-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                时长
              </h4>
              <div className="flex gap-2">
                {currentModelCaps.seconds.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={disabled}
                    onClick={() => update('grokSeconds', s as VideoParams['grokSeconds'])}
                    className={`rounded-lg px-4 py-2 text-sm transition ${
                      params.grokSeconds === s
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06]'
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
                {supportedResolutions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => update('resolution', opt.value as VideoParams['resolution'])}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm transition ${
                    params.resolution === opt.value
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06]'
                  }`}
                >
                  {opt.label}
                  {opt.pro && (
                    <span className={`text-[10px] ${params.resolution === opt.value ? 'text-yellow-200' : 'text-yellow-500'}`}>Pro</span>
                  )}
                </button>
              ))}
            </div>
            </div>
          )}

          {/* 音画 */}
          {currentModelCaps.audio && (
            <div className="mb-3">
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
                <div className="mt-3">
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
