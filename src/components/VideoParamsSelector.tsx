import type { VideoParams } from '../types'
import Select from './Select'

interface VideoParamsSelectorProps {
  params: VideoParams
  onChange: (params: VideoParams) => void
  disabled?: boolean
}

const RESOLUTION_OPTIONS = [
  { label: '480p', value: '480p' },
  { label: '720p', value: '720p' },
  { label: '1080p', value: '1080p' },
]

const DURATION_OPTIONS = [
  { label: '4 秒', value: 4 },
  { label: '5 秒', value: 5 },
  { label: '10 秒', value: 10 },
  { label: '15 秒', value: 15 },
]

const RATIO_OPTIONS = [
  { label: '16:9 横屏', value: '16:9' },
  { label: '9:16 竖屏', value: '9:16' },
  { label: '1:1 方形', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
  { label: '21:9 超宽', value: '21:9' },
  { label: '自适应', value: 'adaptive' },
]

export default function VideoParamsSelector({ params, onChange, disabled }: VideoParamsSelectorProps) {
  const update = (key: keyof VideoParams, value: VideoParams[keyof VideoParams]) => {
    onChange({ ...params, [key]: value })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="w-[90px]">
        <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">分辨率</label>
        <Select
          value={params.resolution}
          onChange={(v) => update('resolution', v)}
          options={RESOLUTION_OPTIONS}
          disabled={disabled}
          className="w-full rounded-lg border border-gray-200/70 bg-white/60 px-2.5 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:focus:border-blue-500/50"
        />
      </div>
      <div className="w-[80px]">
        <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">时长</label>
        <Select
          value={params.duration}
          onChange={(v) => update('duration', typeof v === 'number' ? v : Number(v))}
          options={DURATION_OPTIONS}
          disabled={disabled}
          className="w-full rounded-lg border border-gray-200/70 bg-white/60 px-2.5 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:focus:border-blue-500/50"
        />
      </div>
      <div className="w-[90px]">
        <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">比例</label>
        <Select
          value={params.ratio}
          onChange={(v) => update('ratio', v)}
          options={RATIO_OPTIONS}
          disabled={disabled}
          className="w-full rounded-lg border border-gray-200/70 bg-white/60 px-2.5 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:focus:border-blue-500/50"
        />
      </div>
      <div className="w-[90px]">
        <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">种子</label>
        <input
          type="number"
          value={params.seed ?? ''}
          onChange={(e) => update('seed', e.target.value ? Number(e.target.value) : undefined)}
          placeholder="随机"
          disabled={disabled}
          className="w-full rounded-lg border border-gray-200/70 bg-white/60 px-2.5 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:focus:border-blue-500/50 placeholder-gray-400"
        />
      </div>
      <Toggle label="水印" value={params.watermark ?? false} onChange={(v) => update('watermark', v)} />
      <Toggle label="音画" value={params.generateAudio ?? false} onChange={(v) => update('generateAudio', v)} />
      <Toggle label="定镜" value={params.cameraFixed ?? false} onChange={(v) => update('cameraFixed', v)} />
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex flex-col items-center gap-1 pt-4">
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
      >
        <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
      <span className="text-[10px] text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  )
}
