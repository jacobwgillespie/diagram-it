import {useCallback, useRef} from 'react'
import {useLocalStorage} from './useLocalStorage'

interface DiagramHistoryEntry {
  type: 'user' | 'agent'
  content: string
  prompt?: string // Only for agent entries
  timestamp: number
  id: string
}

interface DiagramHistoryState {
  entries: DiagramHistoryEntry[]
  currentIndex: number
}

interface DiagramHistoryActions {
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  clear: (resetToInitial?: boolean) => void
  addUserCode: (code: string) => void
  addAgentCode: (code: string, prompt: string) => void
  updateCurrentEntry: (content: string) => void
  getCurrentDiagramCode: () => string
  // Expose history data for debugging
  entries: DiagramHistoryEntry[]
  currentIndex: number
}

const MAX_HISTORY_SIZE = 100

export function useDiagramHistory(
  initialCode: string = '',
  storageKey: string = 'diagram-conversation-history',
): [string, DiagramHistoryActions] {
  const createInitialHistory = (): DiagramHistoryState => ({
    entries: initialCode
      ? [
          {
            type: 'user',
            content: initialCode,
            timestamp: Date.now(),
            id: Math.random().toString(36).substr(2, 9),
          },
        ]
      : [],
    currentIndex: initialCode ? 0 : -1,
  })

  const [history, setHistory] = useLocalStorage<DiagramHistoryState>(storageKey, createInitialHistory())

  // Ensure history is defined with proper defaults
  const safeHistory = history || createInitialHistory()
  let entries = safeHistory.entries || []
  let currentIndex = safeHistory.currentIndex ?? -1

  // If we have initialCode but no entries, create the initial user entry
  if (initialCode && entries.length === 0) {
    const initialEntry: DiagramHistoryEntry = {
      type: 'user',
      content: initialCode,
      timestamp: Date.now(),
      id: Math.random().toString(36).substr(2, 9),
    }
    entries = [initialEntry]
    currentIndex = 0
    // Update the history state
    setHistory({entries, currentIndex})
  }

  const currentEntry = currentIndex >= 0 && entries[currentIndex] ? entries[currentIndex] : null
  const currentDiagramCode =
    currentEntry?.type === 'user' || currentEntry?.type === 'agent' ? currentEntry.content : initialCode

  const canUndo = currentIndex > 0
  const canRedo = currentIndex < entries.length - 1

  // Track if we're in the middle of an undo/redo operation
  const isUndoRedoRef = useRef(false)

  const undo = useCallback(() => {
    if (!canUndo || isUndoRedoRef.current) return

    isUndoRedoRef.current = true
    setHistory((prev) => {
      const safePrev = prev || createInitialHistory()
      const prevIndex = safePrev.currentIndex ?? 0
      return {
        ...safePrev,
        currentIndex: Math.max(0, prevIndex - 1),
      }
    })

    setTimeout(() => {
      isUndoRedoRef.current = false
    }, 0)
  }, [canUndo, setHistory])

  const redo = useCallback(() => {
    if (!canRedo || isUndoRedoRef.current) return

    isUndoRedoRef.current = true
    setHistory((prev) => {
      const safePrev = prev || createInitialHistory()
      const prevEntries = safePrev.entries || []
      const prevIndex = safePrev.currentIndex ?? -1
      return {
        ...safePrev,
        currentIndex: Math.min(prevEntries.length - 1, prevIndex + 1),
      }
    })

    setTimeout(() => {
      isUndoRedoRef.current = false
    }, 0)
  }, [canRedo, setHistory])

  const clear = useCallback(
    (resetToInitial: boolean = false) => {
      if (resetToInitial && initialCode) {
        setHistory(createInitialHistory())
      } else {
        setHistory({
          entries: [],
          currentIndex: -1,
        })
      }
    },
    [setHistory, initialCode],
  )

  const addEntry = useCallback(
    (type: DiagramHistoryEntry['type'], content: string) => {
      if (isUndoRedoRef.current) return

      setHistory((prev) => {
        // Ensure prev has proper structure
        const safePrev = prev || createInitialHistory()
        const prevEntries = safePrev.entries || []
        const prevIndex = safePrev.currentIndex ?? -1

        const newEntry: DiagramHistoryEntry = {
          type,
          content,
          timestamp: Date.now(),
          id: Math.random().toString(36).substr(2, 9),
        }

        // Remove any entries after current index (like traditional undo/redo)
        const newEntries = [...prevEntries.slice(0, prevIndex + 1), newEntry]

        // Trim to max size
        const trimmedEntries =
          newEntries.length > MAX_HISTORY_SIZE ? newEntries.slice(newEntries.length - MAX_HISTORY_SIZE) : newEntries

        return {
          entries: trimmedEntries,
          currentIndex: trimmedEntries.length - 1,
        }
      })
    },
    [setHistory],
  )

  const updateCurrentEntry = useCallback(
    (content: string) => {
      if (isUndoRedoRef.current) return

      setHistory((prev) => {
        // Ensure prev has proper structure
        const safePrev = prev || createInitialHistory()
        const prevEntries = safePrev.entries || []
        const prevIndex = safePrev.currentIndex ?? -1

        if (prevIndex < 0 || !prevEntries[prevIndex]) return safePrev

        const updatedEntries = [...prevEntries]
        updatedEntries[prevIndex] = {
          ...updatedEntries[prevIndex],
          content,
          timestamp: Date.now(),
        }

        return {
          ...safePrev,
          entries: updatedEntries,
        }
      })
    },
    [setHistory],
  )

  const addUserCode = useCallback(
    (code: string) => {
      addEntry('user', code)
    },
    [addEntry],
  )

  const addAgentCode = useCallback(
    (code: string, prompt: string) => {
      if (isUndoRedoRef.current) return

      setHistory((prev) => {
        // Ensure prev has proper structure
        const safePrev = prev || createInitialHistory()
        const prevEntries = safePrev.entries || []
        const prevIndex = safePrev.currentIndex ?? -1

        const newEntry: DiagramHistoryEntry = {
          type: 'agent',
          content: code,
          prompt: prompt,
          timestamp: Date.now(),
          id: Math.random().toString(36).substr(2, 9),
        }

        // Remove any entries after current index (like traditional undo/redo)
        const newEntries = [...prevEntries.slice(0, prevIndex + 1), newEntry]

        // Trim to max size
        const trimmedEntries =
          newEntries.length > MAX_HISTORY_SIZE ? newEntries.slice(newEntries.length - MAX_HISTORY_SIZE) : newEntries

        return {
          entries: trimmedEntries,
          currentIndex: trimmedEntries.length - 1,
        }
      })
    },
    [setHistory],
  )

  const getCurrentDiagramCode = useCallback(() => {
    return currentDiagramCode
  }, [currentDiagramCode])

  const historyActions: DiagramHistoryActions = {
    canUndo,
    canRedo,
    undo,
    redo,
    clear,
    addUserCode,
    addAgentCode,
    updateCurrentEntry,
    getCurrentDiagramCode,
    entries: entries,
    currentIndex: currentIndex,
  }

  return [currentDiagramCode, historyActions]
}
