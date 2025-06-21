import {useConversation} from '@elevenlabs/react'
import {useCallback, useEffect, useReducer, useRef} from 'react'
import {generateDiagramStreaming} from './diagram'
import {HistoryEntry} from './HistoryEntry'
import {
  ClarityMicrophoneLine,
  ClarityMicrophoneSolid,
  ClarityRedoLine,
  ClarityTrashLine,
  ClarityUndoLine,
  HumbleiconsSpinnerEarring,
  MaterialSymbolsLightSendOutlineRounded,
} from './icons'
import {MermaidDiagram} from './Mermaid'
import {useDiagramHistory} from './useDiagramHistory'
import {cx} from 'class-variance-authority'

const defaultDiagram = `graph TD
    A[User] --> B[Web Browser]
    B --> C[Load Balancer]
    C --> D[Application Server]
    D --> E[Database]`

const AGENT_ID = 'agent_01jy7dj476fchbe6bwfnc78ga0'

type State = {
  error: string | null
  prompt: string
  isGenerating: boolean
  currentAttempt: number
  isStreaming: boolean
}

type Action =
  | {type: 'SET_ERROR'; payload: string | null}
  | {type: 'SET_PROMPT'; payload: string}
  | {type: 'SET_IS_GENERATING'; payload: boolean}
  | {type: 'SET_CURRENT_ATTEMPT'; payload: number}
  | {type: 'SET_IS_LISTENING'; payload: boolean}
  | {type: 'SET_IS_STREAMING'; payload: boolean}
  | {type: 'START_GENERATING'}
  | {type: 'STOP_GENERATING'}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_ERROR':
      // Only update if the error has actually changed
      if (state.error === action.payload) {
        return state // No change, return same state to prevent unnecessary re-renders
      }
      return {...state, error: action.payload}
    case 'SET_PROMPT':
      return {...state, prompt: action.payload}
    case 'SET_IS_GENERATING':
      return {...state, isGenerating: action.payload}
    case 'SET_CURRENT_ATTEMPT':
      return {...state, currentAttempt: action.payload}
    case 'SET_IS_STREAMING':
      return {...state, isStreaming: action.payload}
    case 'START_GENERATING':
      return {
        ...state,
        isGenerating: true,
        isStreaming: true,
        error: null,
        currentAttempt: 0,
      }
    case 'STOP_GENERATING':
      return {
        ...state,
        isGenerating: false,
        isStreaming: false,
        currentAttempt: 0,
      }
    default:
      return state
  }
}

const createInitialState = (): State => ({
  error: null,
  prompt: '',
  isGenerating: false,
  currentAttempt: 0,
  isStreaming: false,
})

export function App() {
  const [state, dispatch] = useReducer(reducer, createInitialState())
  const [currentDiagram, diagramHistory] = useDiagramHistory(defaultDiagram, 'mermaid-diagram-history')
  const lastValidDiagram = useRef(currentDiagram)

  const conversation = useConversation({
    clientTools: {
      updateDiagram: ({userRequest}: {userRequest: string}) => {
        dispatch({type: 'SET_PROMPT', payload: userRequest})
        handleGenerateDiagram(userRequest)
      },
    },
  })

  // Update lastValidDiagram ref when currentDiagram changes
  useEffect(() => {
    if (currentDiagram.trim()) {
      lastValidDiagram.current = currentDiagram
    }
  }, [currentDiagram])

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault()
        diagramHistory.undo()
      } else if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && (e.key === 'Z' || e.key === 'z')) || e.key === 'y')) {
        e.preventDefault()
        diagramHistory.redo()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [diagramHistory])

  const setError = useCallback(
    (error: string | null) => {
      if (!state.isStreaming) dispatch({type: 'SET_ERROR', payload: error})
    },
    [state.isStreaming],
  )

  const handleGenerateDiagram = async (overridePrompt?: string) => {
    const currentPrompt = overridePrompt || state.prompt
    if (!currentPrompt.trim() || state.isGenerating) return

    dispatch({type: 'START_GENERATING'})

    // Use the most recent valid diagram as the base
    const baselineCode = lastValidDiagram.current

    // Create agent code entry with prompt and current diagram as starting point
    diagramHistory.addAgentCode(baselineCode, currentPrompt)

    const result = await generateDiagramStreaming({
      prompt: currentPrompt,
      currentDiagram: baselineCode,
      history: diagramHistory.entries.slice(0, diagramHistory.currentIndex),
      onAttempt: (attempt) => dispatch({type: 'SET_CURRENT_ATTEMPT', payload: attempt}),
      onToken: (_chunk, _fullText) => {},
      onDiagramUpdate: (diagram) => {
        // Update the agent code entry as new content streams in
        diagramHistory.updateCurrentEntry(diagram)
      },
    })

    dispatch({type: 'SET_IS_STREAMING', payload: false})

    if (result.success && result.diagram) {
      // Final update to ensure we have the complete diagram
      diagramHistory.updateCurrentEntry(result.diagram)
      dispatch({type: 'SET_ERROR', payload: null})
    } else if (result.error) {
      dispatch({type: 'SET_ERROR', payload: result.error})
    }

    // Always clear the prompt when generation is done (success or failure)
    dispatch({type: 'SET_PROMPT', payload: ''})
    dispatch({type: 'STOP_GENERATING'})
  }

  const handleStartListening = async () => {
    try {
      dispatch({type: 'SET_IS_LISTENING', payload: true})
      await conversation.startSession({
        agentId: AGENT_ID,
        onConnect() {
          conversation.setVolume({volume: 0})
        },
      })
    } catch (err) {
      dispatch({type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to start conversation'})
      dispatch({type: 'SET_IS_LISTENING', payload: false})
    }
  }

  const handleStopListening = async () => {
    try {
      if (conversation) {
        await conversation.endSession()
      }
      dispatch({type: 'SET_IS_LISTENING', payload: false})
    } catch (err) {
      dispatch({type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Failed to stop conversation'})
    }
  }

  const conversationID = conversation.status === 'connected' ? conversation.getId() : null

  return (
    <div className="relative flex h-screen w-screen">
      <div className="relative flex flex-1 flex-col border-r border-neutral-700">
        {state.error && (
          <div className="absolute top-4 right-4 left-4 z-50 rounded border border-red-900 bg-red-950 p-2 px-3 text-sm text-red-400">
            Error: {state.error}
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          <MermaidDiagram diagram={currentDiagram || defaultDiagram} className="h-full w-full" setError={setError} />
        </div>
      </div>

      {/* Right side - Code editor */}
      <div className="flex min-w-0 flex-1 flex-col bg-neutral-900">
        <div className="mx-4 mt-4 flex items-center justify-between gap-2">
          <div className="relative h-10 flex-1">
            <input
              type="text"
              value={state.prompt}
              onChange={(e) => dispatch({type: 'SET_PROMPT', payload: e.target.value})}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleGenerateDiagram()
                }
              }}
              placeholder="Enter prompt..."
              className="h-10 w-full rounded border border-neutral-700 bg-neutral-900 p-2 text-sm outline-none focus:border-neutral-500"
            />
            <button
              type="button"
              onClick={() => handleGenerateDiagram()}
              className={cx(
                'absolute top-0 right-2 h-10 text-white transition-colors',
                state.isGenerating && 'animate-spin',
              )}
              disabled={state.isGenerating}
            >
              {state.isGenerating && <HumbleiconsSpinnerEarring className="h-4 w-4" />}
              {!state.isGenerating && <MaterialSymbolsLightSendOutlineRounded className="h-4 w-4" />}
            </button>
          </div>
          <button
            type="button"
            onClick={conversationID ? handleStopListening : handleStartListening}
            className={cx(
              'flex h-10 w-10 items-center justify-center rounded border p-1 text-sm text-white transition-colors',
              conversationID && 'border-green-700 bg-green-900',
              !conversationID && 'border-neutral-700 hover:border-neutral-500',
            )}
            title={conversationID ? 'Stop Listening' : 'Start Listening'}
          >
            {conversationID && <ClarityMicrophoneSolid className="text-green-300" />}
            {!conversationID && <ClarityMicrophoneLine />}
          </button>
        </div>

        <textarea
          value={currentDiagram || defaultDiagram}
          onChange={(e) => {
            const newCode = e.target.value
            // Update current entry or create new user-code entry
            if (
              diagramHistory.entries.length === 0 ||
              diagramHistory.entries[diagramHistory.currentIndex]?.type !== 'user-code'
            ) {
              diagramHistory.addUserCode(newCode)
            } else {
              diagramHistory.updateCurrentEntry(newCode)
            }
          }}
          className="flex-1 resize-none bg-neutral-900 p-4 text-sm text-white outline-none"
          placeholder="Enter your Mermaid diagram code here..."
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-neutral-700 bg-neutral-950 p-4">
          <div className="space-y-1 text-xs">
            {diagramHistory.entries.map((entry, index) => (
              <HistoryEntry key={entry.id} entry={entry} isCurrent={index === diagramHistory.currentIndex} />
            ))}

            {diagramHistory.entries.length === 0 && (
              <div className="py-4 text-center text-neutral-500">No conversation history</div>
            )}
          </div>
        </div>

        <div className="fixed right-4 bottom-4 z-50 flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={diagramHistory.undo}
              disabled={!diagramHistory.canUndo}
              className="rounded border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white transition-colors hover:bg-neutral-700 disabled:bg-neutral-900 disabled:opacity-50"
              title="Undo (Ctrl+Z)"
            >
              <ClarityUndoLine />
            </button>
            <button
              type="button"
              onClick={diagramHistory.redo}
              disabled={!diagramHistory.canRedo}
              className="rounded border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white transition-colors hover:bg-neutral-700 disabled:bg-neutral-900 disabled:opacity-50"
              title="Redo (Ctrl+Y)"
            >
              <ClarityRedoLine />
            </button>
            <button
              type="button"
              onClick={() => {
                // Clear history and reset to empty state
                diagramHistory.clear()
              }}
              className="rounded border border-red-600 bg-red-800 px-3 py-2 text-sm text-white transition-colors hover:bg-red-700"
              title="Clear History and Reset"
            >
              <ClarityTrashLine />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
