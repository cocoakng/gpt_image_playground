import { useCallback, useEffect, useRef, useState } from 'react'

interface VideoPlayerProps {
  videoUrl: string
  coverUrl?: string
  className?: string
}

export default function VideoPlayer({ videoUrl, coverUrl, className = '' }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setCurrentDuration] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play().catch(() => setError('视频播放失败，URL 可能已过期'))
    } else {
      video.pause()
    }
  }, [])

  const handleTimeUpdate = useCallback(() => {
    setCurrentTime(videoRef.current?.currentTime ?? 0)
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    setCurrentDuration(videoRef.current?.duration ?? 0)
    setIsLoading(false)
  }, [])

  const handleWaiting = useCallback(() => setIsLoading(true), [])
  const handleCanPlay = useCallback(() => setIsLoading(false), [])

  const handleError = useCallback(() => {
    setIsLoading(false)
    setError('视频加载失败，URL 可能已过期')
  }, [])

  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    setCurrentDuration(0)
    setIsLoading(true)
    setError(null)
  }, [videoUrl])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className={`relative w-full rounded-xl overflow-hidden bg-black ${className}`}>
      <video
        ref={videoRef}
        src={videoUrl}
        poster={coverUrl}
        className="w-full max-h-[80vh] object-contain"
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={handleWaiting}
        onCanPlay={handleCanPlay}
        onError={handleError}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Loading overlay */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white">
          <svg className="w-12 h-12 mb-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-center px-4">{error}</p>
        </div>
      )}

      {/* Play/Pause overlay button */}
      {!isPlaying && !error && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
          aria-label="播放"
        >
          <div className="h-16 w-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg transition-transform hover:scale-105">
            <svg className="w-7 h-7 text-gray-900 ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </button>
      )}

      {/* Controls bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 hover:opacity-100 transition-opacity">
        {/* Progress bar */}
        <div
          className="w-full h-1 bg-white/30 rounded-full cursor-pointer mb-2"
          onClick={(e) => {
            const video = videoRef.current
            if (!video || !duration) return
            const rect = e.currentTarget.getBoundingClientRect()
            const percent = (e.clientX - rect.left) / rect.width
            video.currentTime = percent * duration
          }}
        >
          <div
            className="h-full bg-white rounded-full transition-[width]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={togglePlay}
            className="text-white hover:text-gray-300 transition-colors"
            aria-label={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <span className="text-xs text-white/80 font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  )
}
