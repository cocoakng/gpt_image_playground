import { useStore } from '../store'
import VideoTaskGrid from './VideoTaskGrid'
import VideoInputBar from './VideoInputBar'
import SearchBar from './SearchBar'
import { FavoriteCollectionsView } from './FavoriteCollections'

export default function VideoWorkspace() {
  const videoProfiles = useStore((s) => s.videoProfiles)
  const filterFavorite = useStore((s) => s.filterVideoFavorite)
  const activeFavoriteCollectionId = useStore((s) => s.activeVideoFavoriteCollectionId)
  const setShowSettings = useStore((s) => s.setShowSettings)

  if (videoProfiles.length === 0) {
    return (
      <main className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center max-w-md px-6">
          <svg className="mx-auto mb-6 h-20 w-20 text-gray-300 dark:text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">视频功能未配置</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            请先在设置中添加视频 API 配置，支持兼容 OpenAI 异步格式的视频生成服务。
          </p>
          <button
            type="button"
            onClick={() => setShowSettings(true, 'video')}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            前往视频配置
          </button>
        </div>
      </main>
    )
  }

  return (
    <main data-home-main data-drag-select-surface className="pb-48">
      <div className="safe-area-x max-w-7xl mx-auto">
        <SearchBar />
        {filterFavorite && !activeFavoriteCollectionId ? <FavoriteCollectionsView /> : <VideoTaskGrid />}
      </div>
      <VideoInputBar />
    </main>
  )
}
