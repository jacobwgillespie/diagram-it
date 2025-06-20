import {useCallback, useRef} from 'react'
import {useLocalStorage} from './useLocalStorage'

interface HistoryEntry<T> {
  state: T
  action: any
  timestamp: number
}

interface HistoryState<T> {
  past: HistoryEntry<T>[]
  present: HistoryEntry<T>
  future: HistoryEntry<T>[]
}

interface HistoryActions<T> {
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  clear: (newState?: T) => void
  // Expose history data for debugging
  past: HistoryEntry<T>[]
  future: HistoryEntry<T>[]
  present: HistoryEntry<T>
}

type DispatchMode = 'normal' | 'overwrite'

type EnhancedDispatch<A> = {
  (action: A): void
  (action: A, mode: DispatchMode): void
}

const MAX_HISTORY_SIZE = 50

export function useReducerHistory<T, A>(
  reducer: (state: T, action: A) => T,
  initialState: T,
  storageKey?: string,
): [T, EnhancedDispatch<A>, HistoryActions<T>] {
  const createInitialHistory = (): HistoryState<T> => ({
    past: [],
    present: {
      state: initialState,
      action: {type: '__INITIAL__'},
      timestamp: Date.now(),
    },
    future: [],
  })

  // Always use localStorage with a unique key if no storageKey provided
  const effectiveStorageKey = storageKey || `__temp_history_${Math.random().toString(36).substr(2, 9)}`
  const [history, setHistory] = useLocalStorage<HistoryState<T>>(effectiveStorageKey, createInitialHistory())

  const currentState = history.present.state
  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0

  // Track if we're in the middle of an undo/redo operation to prevent infinite loops
  const isUndoRedoRef = useRef(false)

  const undo = useCallback(() => {
    if (!canUndo || isUndoRedoRef.current) return

    isUndoRedoRef.current = true
    const previous = history.past[history.past.length - 1]
    const newPast = history.past.slice(0, history.past.length - 1)

    const newHistory = {
      past: newPast,
      present: previous,
      future: [history.present, ...history.future],
    }

    setHistory(newHistory)

    // Reset flag after state update completes
    setTimeout(() => {
      isUndoRedoRef.current = false
    }, 0)
  }, [canUndo, history, setHistory])

  const redo = useCallback(() => {
    if (!canRedo || isUndoRedoRef.current) return

    isUndoRedoRef.current = true
    const next = history.future[0]
    const newFuture = history.future.slice(1)

    const newHistory = {
      past: [...history.past, history.present],
      present: next,
      future: newFuture,
    }

    setHistory(newHistory)

    // Reset flag after state update completes
    setTimeout(() => {
      isUndoRedoRef.current = false
    }, 0)
  }, [canRedo, history, setHistory])

  const clear = useCallback(
    (newState?: T) => {
      const resetState = newState !== undefined ? newState : initialState
      const newHistory: HistoryState<T> = {
        past: [],
        present: {state: resetState, action: {type: '__CLEAR__'}, timestamp: Date.now()},
        future: [],
      }
      setHistory(newHistory)
    },
    [setHistory, initialState],
  )

  const dispatch = useCallback(
    (action: A, mode: DispatchMode = 'normal') => {
      // Don't create history entries during undo/redo operations
      if (isUndoRedoRef.current) return

      setHistory((currentHistory) => {
        const newState = reducer(currentHistory.present.state, action)

        // If state hasn't changed, don't do anything
        if (newState === currentHistory.present.state) return currentHistory

        const newEntry: HistoryEntry<T> = {
          state: newState,
          action,
          timestamp: Date.now(),
        }

        if (mode === 'overwrite') {
          return {...currentHistory, present: newEntry}
        }
        const newPast = [...currentHistory.past, currentHistory.present]
        const trimmedPast =
          newPast.length > MAX_HISTORY_SIZE ? newPast.slice(newPast.length - MAX_HISTORY_SIZE) : newPast
        return {past: trimmedPast, present: newEntry, future: []}
      })
    },
    [reducer, setHistory],
  )

  const historyActions: HistoryActions<T> = {
    canUndo,
    canRedo,
    undo,
    redo,
    clear,
    past: history.past,
    future: history.future,
    present: history.present,
  }

  return [currentState, dispatch as EnhancedDispatch<A>, historyActions]
}
