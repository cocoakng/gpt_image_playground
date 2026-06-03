import type { VideoParams } from '../types'
import Select from './Select'

interface VideoParamsSelectorProps {
  params: VideoParams
  onChange: (params: VideoParams) => void
  disabled?: boolean
}

const RESOLUTION_OPTIONS = [
  { label: '720p', value: '720p' },
  { label: '1080p', value: '1080p' },
]

const DURATION_OPTIONS = [
  { label: '5 秒', value: '5s' },
  { label: '10 秒', value: '10s' },
]

const RATIO_OPTIONS = [
  { label: '16:9 横屏', value: '16:9' },
  { label: '9:16 竖屏', value: '9:16' },
  { label: '1:1 方形', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
]

export default function VideoParamsSelector({ params, onChange, disabled }: VideoParamsSelectorProps) {
  const update = (key: keyof VideoParams, value: VideoParams[keyof VideoParams]) => {
    onChange({ ...params, [key]: value })
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">分辨率</label>
        <Select
          value={params.resolution}
          onChange={(v) => update('resolution', v)}
          options={RESOLUTION_OPTIONS}
          disabled={disabled}
          className="w-full rounded-lg border border-gray-200/70 bg-white/60 px-2.5 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:focus:border-blue-500/50"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">时长</label>
        <Select
          value={params.duration}
          onChange={(v) => update('duration', v)}
          options={DURATION_OPTIONS}
          disabled={disabled}
          className="w-full rounded-lg border border-gray-200/70 bg-white/60 px-2.5 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:focus:border-blue-500/50"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">比例</label>
        <Select
          value={params.ratio}
          onChange={(v) => update('ratio', v)}
          options={RATIO_OPTIONS}
          disabled={disabled}
          className="w-full rounded-lg border border-gray-200/70 bg-white/60 px-2.5 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:focus:border-blue-500/50"
        />
      </div>
    </div>
  )
}
