import {useEffect, useRef} from 'react'
import {cx} from 'class-variance-authority'

interface HistoryEntryProps {
  entry: {
    id: string
    type: 'user-code' | 'agent-code'
    timestamp: number
    prompt?: string
    content: string
  }
  isCurrent: boolean
}

export function HistoryEntry({entry, isCurrent}: HistoryEntryProps) {
  const entryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isCurrent || !entryRef.current) return
    entryRef.current.scrollIntoView({behavior: 'smooth', block: 'nearest'})
  }, [isCurrent])

  return (
    <div ref={entryRef} className={cx('space-y-2 rounded p-4', isCurrent && 'border border-blue-700 bg-blue-900/30')}>
      <div className="flex items-center justify-between gap-2">
        <div className={cx('text-xs font-medium', entry.type === 'user-code' ? 'text-blue-400' : 'text-purple-400')}>
          {entry.type.toUpperCase().replace('-', ' ')}
        </div>
        {entry.type === 'agent-code' && entry.prompt && (
          <div className="flex-1 truncate text-xs text-neutral-500 italic">"{entry.prompt}"</div>
        )}
        <div className="font-mono text-xs text-neutral-500">{new Date(entry.timestamp).toLocaleTimeString()}</div>
      </div>
      <div className={cx('truncate text-xs', isCurrent ? 'text-blue-200' : 'text-neutral-400')}>
        {entry.content.trim() || '...'}
      </div>
    </div>
  )
}
