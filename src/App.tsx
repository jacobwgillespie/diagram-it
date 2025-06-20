import {useConversation} from '@elevenlabs/react'
import mermaid from 'mermaid'
import {useEffect, useRef, useState} from 'react'
import {generateDiagramStreaming} from './diagram'
import {
  ClarityMicrophoneLine,
  ClarityMicrophoneMuteLine,
  ClarityRedoLine,
  ClarityTerminalLine,
  ClarityTrashLine,
  ClarityUndoLine,
} from './icons'
import {MermaidDiagram} from './Mermaid'
import {useLocalStorage} from './useLocalStorage'
import {useReducerHistory} from './useReducerHistory'

const defaultDiagram = `graph TD
    A[User] --> B[Web Browser]
    B --> C[Web Server]
    C --> D[Application Server]
    D --> E[Database]`

const AGENT_ID = 'agent_01jy7dj476fchbe6bwfnc78ga0'

type State = {
  code: string
  currentDiagram: string
  error: string | null
  prompt: string
  isGenerating: boolean
  currentAttempt: number
  rawResponse: string
  isListening: boolean
  isStreaming: boolean
}

type Action =
  | {type: 'SET_CODE'; payload: string}
  | {type: 'SET_CURRENT_DIAGRAM'; payload: string}
  | {type: 'SET_ERROR'; payload: string | null}
  | {type: 'SET_PROMPT'; payload: string}
  | {type: 'SET_IS_GENERATING'; payload: boolean}
  | {type: 'SET_CURRENT_ATTEMPT'; payload: number}
  | {type: 'SET_RAW_RESPONSE'; payload: string}
  | {type: 'SET_IS_LISTENING'; payload: boolean}
  | {type: 'SET_IS_STREAMING'; payload: boolean}
  | {type: 'START_GENERATING'}
  | {type: 'STOP_GENERATING'}
  | {type: 'UPDATE_DIAGRAM'; payload: {code: string; currentDiagram: string}}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_CODE':
      return {...state, code: action.payload}
    case 'SET_CURRENT_DIAGRAM':
      return {...state, currentDiagram: action.payload}
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
    case 'SET_RAW_RESPONSE':
      return {...state, rawResponse: action.payload}
    case 'SET_IS_LISTENING':
      return {...state, isListening: action.payload}
    case 'SET_IS_STREAMING':
      return {...state, isStreaming: action.payload}
    case 'START_GENERATING':
      return {
        ...state,
        isGenerating: true,
        isStreaming: true,
        error: null,
        currentAttempt: 0,
        rawResponse: '',
      }
    case 'STOP_GENERATING':
      return {
        ...state,
        isGenerating: false,
        isStreaming: false,
        currentAttempt: 0,
      }
    case 'UPDATE_DIAGRAM':
      return {
        ...state,
        code: action.payload.code,
        currentDiagram: action.payload.currentDiagram,
      }
    default:
      return state
  }
}

const createInitialState = (savedCode: string): State => ({
  code: savedCode,
  currentDiagram: savedCode,
  error: null,
  prompt: '',
  isGenerating: false,
  currentAttempt: 0,
  rawResponse: '',
  isListening: false,
  isStreaming: false,
})

function App() {
  const [savedCode, setSavedCode] = useLocalStorage('mermaid-diagram-code', defaultDiagram)
  const [state, dispatch, historyActions] = useReducerHistory(
    reducer,
    createInitialState(savedCode),
    'mermaid-app-history',
  )
  const lastValidDiagram = useRef(savedCode)
  const isStreamingRef = useRef(false)
  const lastErrorRef = useRef<string | null>(null)

  const [showDebugPanel, setShowDebugPanel] = useState(false)

  const conversation = useConversation({
    clientTools: {
      updateDiagram: ({userRequest}: {userRequest: string}) => {
        dispatch({type: 'SET_PROMPT', payload: userRequest})
        handleGenerateDiagram(userRequest)
      },
    },
  })

  useEffect(() => {
    // Skip validation during streaming to prevent errors while diagram is being built
    if (state.isStreaming) return

    const validateAndUpdate = async () => {
      if (!state.code.trim()) {
        const errorMsg = 'Please enter a diagram'
        if (lastErrorRef.current !== errorMsg) {
          lastErrorRef.current = errorMsg
          dispatch({type: 'SET_ERROR', payload: errorMsg})
        }
        return
      }

      try {
        // Initialize mermaid if needed
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose',
          fontFamily: 'inherit',
        })

        // Validate the diagram syntax
        const isValid = await mermaid.parse(state.code)

        if (isValid) {
          // Update the current diagram and store as last valid
          dispatch({type: 'SET_CURRENT_DIAGRAM', payload: state.code})
          lastValidDiagram.current = state.code
          // Clear error only if there was one before
          if (lastErrorRef.current !== null) {
            lastErrorRef.current = null
            dispatch({type: 'SET_ERROR', payload: null})
          }
          // Save valid code to localStorage
          setSavedCode(state.code)
          // History is automatically managed by useReducerHistory
          // No need to manually push to history here
        }
      } catch (err) {
        // Show error but keep the last valid diagram
        const errorMsg = err instanceof Error ? err.message : 'Invalid diagram syntax'
        if (lastErrorRef.current !== errorMsg) {
          lastErrorRef.current = errorMsg
          dispatch({type: 'SET_ERROR', payload: errorMsg})
        }
        dispatch({type: 'SET_CURRENT_DIAGRAM', payload: lastValidDiagram.current})
      }
    }

    validateAndUpdate()
  }, [state.code, state.isStreaming, dispatch, setSavedCode])

  // Sync saved code with current state
  useEffect(() => {
    setSavedCode(state.code)
    lastValidDiagram.current = state.code
  }, [state.code, setSavedCode])

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault()
        historyActions.undo()
      } else if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key === 'Z') || e.key === 'y')) {
        e.preventDefault()
        historyActions.redo()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [historyActions])

  const handleGenerateDiagram = async (overridePrompt?: string) => {
    const currentPrompt = overridePrompt || state.prompt
    if (!currentPrompt.trim() || state.isGenerating) return

    dispatch({type: 'START_GENERATING'})
    isStreamingRef.current = true

    // Use the most recent valid diagram as the base
    const baselineCode = lastValidDiagram.current

    const result = await generateDiagramStreaming({
      prompt: currentPrompt,
      currentDiagram: baselineCode,
      onAttempt: (attempt) => dispatch({type: 'SET_CURRENT_ATTEMPT', payload: attempt}),
      onToken: (_chunk, fullText) => {
        dispatch({type: 'SET_RAW_RESPONSE', payload: fullText})
      },
      onDiagramUpdate: (diagram) => {
        // Update code in real-time as diagram tokens arrive
        dispatch({type: 'UPDATE_DIAGRAM', payload: {code: diagram, currentDiagram: diagram}})
      },
    })

    dispatch({type: 'SET_IS_STREAMING', payload: false})
    isStreamingRef.current = false

    if (result.success && result.diagram) {
      dispatch({type: 'SET_CODE', payload: result.diagram})
      dispatch({type: 'SET_PROMPT', payload: ''})
      dispatch({type: 'SET_ERROR', payload: null})
      // Save successful diagram to localStorage
      setSavedCode(result.diagram)
      // Dispatch will automatically create a history entry
    } else if (result.error) {
      dispatch({type: 'SET_ERROR', payload: result.error})
    }

    if (result.rawResponse) {
      dispatch({type: 'SET_RAW_RESPONSE', payload: result.rawResponse})
    }

    dispatch({type: 'STOP_GENERATING'})
  }

  const handleStartListening = async () => {
    try {
      dispatch({type: 'SET_IS_LISTENING', payload: true})
      await conversation.startSession({agentId: AGENT_ID})
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

  const conversationID = conversation.getId()

  return (
    <div className="relative flex h-screen w-screen">
      <div className="relative flex flex-1 flex-col border-r border-neutral-700">
        {state.error && (
          <div className="absolute top-4 right-4 left-4 rounded border border-red-900 bg-red-950 p-2 px-3 text-sm text-red-400">
            Error: {state.error}
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          <MermaidDiagram
            diagram={state.currentDiagram || defaultDiagram}
            className="h-full w-full"
            suppressErrors={state.isStreaming}
          />
        </div>
      </div>

      {/* Right side - Code editor */}
      <div className="flex flex-1 flex-col bg-neutral-900">
        <div className="mx-4 mt-4 flex gap-2 rounded border border-neutral-700 bg-neutral-900 p-2 px-4 text-sm">
          <input
            type="text"
            value={state.prompt}
            onChange={(e) => dispatch({type: 'SET_PROMPT', payload: e.target.value})}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleGenerateDiagram()
              }
            }}
            placeholder="Enter prompt to generate diagram..."
            disabled={state.isGenerating}
            className="flex-1 text-sm outline-none focus:border-neutral-500 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={state.isListening ? handleStopListening : handleStartListening}
            className="flex items-center justify-center text-sm text-white transition-colors"
            title={state.isListening ? 'Stop Listening' : 'Start Listening'}
          >
            {state.isListening && <ClarityMicrophoneMuteLine />}
            {!state.isListening && <ClarityMicrophoneLine />}
          </button>
        </div>

        {conversationID && (
          <div className="text-xs text-neutral-500">Conversation ID: {conversationID.slice(0, 8)}...</div>
        )}
        {state.isGenerating && (
          <div className="mt-2 text-xs text-neutral-500">
            {state.isStreaming
              ? 'Streaming diagram...'
              : `Generating diagram${state.currentAttempt > 1 ? ` (attempt ${state.currentAttempt}/5)` : ''}...`}
          </div>
        )}

        <textarea
          value={state.code}
          onChange={(e) => {
            const newCode = e.target.value
            // Always use overwrite mode for manual edits - this updates the current history entry
            dispatch({type: 'SET_CODE', payload: newCode}, 'overwrite')
          }}
          className="flex-1 resize-none bg-neutral-900 p-4 text-sm text-white outline-none"
          placeholder="Enter your Mermaid diagram code here..."
        />

        {/* Action buttons */}
        <div className="fixed right-4 bottom-4 z-50 flex flex-col gap-2">
          {/* History controls */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={historyActions.undo}
              disabled={!historyActions.canUndo}
              className="rounded border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white transition-colors hover:bg-neutral-700 disabled:bg-neutral-900 disabled:opacity-50"
              title="Undo (Ctrl+Z)"
            >
              <ClarityUndoLine />
            </button>
            <button
              type="button"
              onClick={historyActions.redo}
              disabled={!historyActions.canRedo}
              className="rounded border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white transition-colors hover:bg-neutral-700 disabled:bg-neutral-900 disabled:opacity-50"
              title="Redo (Ctrl+Y)"
            >
              <ClarityRedoLine />
            </button>
            <button
              type="button"
              onClick={() => {
                // Clear history and reset to empty state
                const emptyState = createInitialState('')
                historyActions.clear(emptyState)
              }}
              className="rounded border border-red-600 bg-red-800 px-3 py-2 text-sm text-white transition-colors hover:bg-red-700"
              title="Clear History and Reset"
            >
              <ClarityTrashLine />
            </button>

            <button
              type="button"
              onClick={() => setShowDebugPanel(!showDebugPanel)}
              className="rounded border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm text-white transition-colors hover:bg-neutral-700"
              title="Toggle Debug Panel"
            >
              <ClarityTerminalLine />
            </button>
          </div>
        </div>

        {/* Slide-up debug panel */}
        <div
          className={`fixed inset-x-0 bottom-0 z-40 border-t border-neutral-700 bg-neutral-900 transition-transform duration-300 ease-in-out ${
            showDebugPanel ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{maxHeight: '50vh'}}
        >
          <div className="flex h-full flex-col p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-white">Debug Panel</h3>
              <button
                type="button"
                onClick={() => setShowDebugPanel(false)}
                className="text-neutral-400 transition-colors hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex h-full gap-4">
              {/* History Panel */}
              <div className="flex flex-1 flex-col">
                <h4 className="mb-2 text-sm font-medium text-white">
                  History ({historyActions.past.length + 1 + historyActions.future.length} entries)
                </h4>
                <div className="flex-1 overflow-y-auto rounded border border-neutral-800 bg-black p-2">
                  <div className="space-y-1 text-xs">
                    {/* Past states */}
                    {historyActions.past.map((entry, index) => (
                      <div key={`past-${index}`} className="rounded p-1 text-neutral-400">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-500">{index + 1}.</span>
                          <span className="font-mono text-xs">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-yellow-400">{JSON.stringify(entry.action).slice(0, 50)}...</div>
                        <div className="truncate text-neutral-500">{entry.state.code.slice(0, 80)}...</div>
                      </div>
                    ))}

                    {/* Current state */}
                    <div className="rounded border border-blue-700 bg-blue-900/30 p-1 text-blue-300">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-400">
                          {historyActions.past.length + 1}. CURRENT
                        </span>
                        <span className="font-mono text-xs">
                          {new Date(historyActions.present.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-blue-300">
                        {JSON.stringify(historyActions.present.action).slice(0, 50)}...
                      </div>
                      <div className="truncate text-blue-200">{historyActions.present.state.code.slice(0, 80)}...</div>
                    </div>

                    {/* Future states */}
                    {historyActions.future.map((entry, index) => (
                      <div key={`future-${index}`} className="rounded p-1 text-neutral-600">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-600">{historyActions.past.length + 2 + index}.</span>
                          <span className="font-mono text-xs">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-neutral-600">{JSON.stringify(entry.action).slice(0, 50)}...</div>
                        <div className="truncate text-neutral-600">{entry.state.code.slice(0, 80)}...</div>
                      </div>
                    ))}

                    {historyActions.past.length === 0 && historyActions.future.length === 0 && (
                      <div className="py-4 text-center text-neutral-500">No history entries</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Model Response Panel */}
              <div className="flex flex-1 flex-col">
                <h4 className="mb-2 text-sm font-medium text-white">Model Response</h4>
                <textarea
                  value={state.rawResponse}
                  readOnly
                  className="flex-1 resize-none rounded border border-neutral-800 bg-black p-3 font-mono text-xs text-neutral-500 outline-none"
                  placeholder="Model response will appear here..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
