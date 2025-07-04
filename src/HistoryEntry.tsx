import {useEffect, useRef} from 'react'
import {cx} from 'class-variance-authority'

interface HistoryEntryProps {
  entry: {
    id: string
    type: 'user' | 'agent'
    timestamp: number
    prompt?: string
    content: string
  }
  isCurrent: boolean
  onClick?: () => void
}

export function HistoryEntry({entry, isCurrent, onClick}: HistoryEntryProps) {
  const entryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isCurrent || !entryRef.current) return
    entryRef.current.scrollIntoView({behavior: 'smooth', block: 'nearest'})
  }, [isCurrent])

  return (
    <div
      ref={entryRef}
      className={cx(
        'space-y-2 rounded border p-4 transition-colors',
        isCurrent ? 'border-green-700 bg-green-900/30' : 'border-transparent',
        onClick && 'cursor-pointer',
        onClick && !isCurrent && 'hover:bg-neutral-800/50',
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <div className={cx('text-xs font-medium', entry.type === 'user' ? 'text-green-400' : 'text-blue-400')}>
          {entry.type.toUpperCase().replace('-', ' ')}
        </div>
        {entry.type === 'agent' && entry.prompt && (
          <div className="flex-1 truncate text-xs text-neutral-500 italic">"{entry.prompt}"</div>
        )}
        <div className="font-mono text-xs text-neutral-500">{new Date(entry.timestamp).toLocaleTimeString()}</div>
      </div>
      <div className={cx('truncate text-xs', isCurrent ? 'text-green-200' : 'text-neutral-400')}>
        {entry.content.trim() || '...'}
      </div>
    </div>
  )
}
