import { useMemo, useRef } from 'react'
import { ALL_FAVORITES_COLLECTION_ID, getTaskFavoriteCollectionIds, useStore, removeTask, reuseVideoConfig, editVideoOutputs } from '../store'
import TaskCard from './TaskCard'

export default function VideoTaskGrid() {
  const tasks = useStore((s) => s.tasks)
  const searchQuery = useStore((s) => s.searchVideoQuery)
  const filterStatus = useStore((s) => s.filterStatus)
  const filterFavorite = useStore((s) => s.filterVideoFavorite)
  const activeFavoriteCollectionId = useStore((s) => s.activeVideoFavoriteCollectionId)
  const setDetailTaskId = useStore((s) => s.setDetailTaskId)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const rootRef = useRef<HTMLDivElement>(null)

  const filteredTasks = useMemo(() => {
    const videoTasks = tasks.filter((t) => t.taskType === 'video')
    const sorted = [...videoTasks].sort((a, b) => b.createdAt - a.createdAt)
    const q = searchQuery.trim().toLowerCase()

    if (!q && filterStatus === 'all' && !filterFavorite) return sorted

    return sorted.filter((t) => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false
      if (filterFavorite) {
        if (!t.isFavorite) return false
        if (activeFavoriteCollectionId && activeFavoriteCollectionId !== ALL_FAVORITES_COLLECTION_ID && !getTaskFavoriteCollectionIds(t).includes(activeFavoriteCollectionId)) return false
      }
      if (!q) return true
      const prompt = (t.prompt || '').toLowerCase()
      const paramStr = JSON.stringify(t.videoParams || {}).toLowerCase()
      return prompt.includes(q) || paramStr.includes(q)
    })
  }, [tasks, searchQuery, filterStatus, filterFavorite, activeFavoriteCollectionId])

  const handleDelete = (task: typeof tasks[number]) => {
    setConfirmDialog({
      title: '删除任务',
      message: '确定要删除此视频任务吗？',
      showCancel: true,
      confirmText: '删除',
      icon: 'copy',
      action: () => void removeTask(task),
    })
  }

  const handleEditOutputs = (task: typeof tasks[number]) => {
    void editVideoOutputs(task)
  }

  return (
    <div ref={rootRef} className="min-h-[300px]">
      {filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-600">
          <svg className="mb-4 h-16 w-16 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">暂无视频任务</p>
          <p className="mt-1 text-xs">在下方输入提示词开始生成视频</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => setDetailTaskId(task.id)}
              onReuse={() => void reuseVideoConfig(task)}
              onEditOutputs={() => handleEditOutputs(task)}
              onDelete={() => handleDelete(task)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
