import mermaid from 'mermaid'
import {memo, useCallback, useEffect, useReducer, useRef} from 'react'
import {
  ClarityMinusLine,
  ClarityPlusLine,
  StreamlineInterfacePageControllerFitScreenFitScreenAdjustDisplayArtboardFrameCorner,
} from './icons'

interface MermaidDiagramProps {
  diagram: string | null | undefined
  className?: string
  id?: string
  setError: (error: string | null) => void
}

type State = {
  isInitialized: boolean
  transform: {x: number; y: number; scale: number}
  isDragging: boolean
  dragStart: {x: number; y: number}
  originalSvgSize: {width: number; height: number}
  hasUserInteracted: boolean
}

type Action =
  | {type: 'SET_INITIALIZED'; payload: boolean}
  | {type: 'SET_TRANSFORM'; payload: {x: number; y: number; scale: number}}
  | {
      type: 'UPDATE_TRANSFORM'
      payload: (prev: {x: number; y: number; scale: number}) => {x: number; y: number; scale: number}
    }
  | {type: 'SET_DRAGGING'; payload: boolean}
  | {type: 'SET_DRAG_START'; payload: {x: number; y: number}}
  | {type: 'SET_ORIGINAL_SVG_SIZE'; payload: {width: number; height: number}}
  | {type: 'START_DRAG'; payload: {x: number; y: number}}
  | {type: 'STOP_DRAG'}
  | {type: 'RESET_VIEW'; payload: {containerWidth: number; containerHeight: number}}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_INITIALIZED':
      return {...state, isInitialized: action.payload}
    case 'SET_TRANSFORM':
      return {...state, transform: action.payload}
    case 'UPDATE_TRANSFORM':
      return {...state, transform: action.payload(state.transform), hasUserInteracted: true}
    case 'SET_DRAGGING':
      return {...state, isDragging: action.payload}
    case 'SET_DRAG_START':
      return {...state, dragStart: action.payload}
    case 'SET_ORIGINAL_SVG_SIZE':
      return {...state, originalSvgSize: action.payload}
    case 'START_DRAG':
      return {
        ...state,
        isDragging: true,
        dragStart: action.payload,
        hasUserInteracted: true,
      }
    case 'STOP_DRAG':
      return {...state, isDragging: false}
    case 'RESET_VIEW': {
      const {containerWidth, containerHeight} = action.payload
      const padding = 80
      const availableWidth = containerWidth - padding
      const availableHeight = containerHeight - padding

      const scaleX = availableWidth / state.originalSvgSize.width
      const scaleY = availableHeight / state.originalSvgSize.height
      const scale = Math.min(scaleX, scaleY)

      const scaledWidth = state.originalSvgSize.width * scale
      const scaledHeight = state.originalSvgSize.height * scale

      return {
        ...state,
        transform: {
          x: (containerWidth - scaledWidth) / 2,
          y: (containerHeight - scaledHeight) / 2,
          scale: scale,
        },
        hasUserInteracted: false,
      }
    }
    default:
      return state
  }
}

const initialState: State = {
  isInitialized: false,
  transform: {x: 0, y: 0, scale: 1},
  isDragging: false,
  dragStart: {x: 0, y: 0},
  originalSvgSize: {width: 0, height: 0},
  hasUserInteracted: false,
}

export const MermaidDiagram = memo(function MermaidDiagram({
  diagram,
  className = '',
  id,
  setError,
}: MermaidDiagramProps) {
  // Ensure diagram is always a string
  const safeDiagram = diagram || ''
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGElement>(null)
  const diagramId = useRef(id || `mermaid-${Math.random().toString(36).substr(2, 9)}`)
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    // Initialize mermaid with default configuration
    const initializeMermaid = async () => {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose',
        fontFamily: 'inherit',
      })
      dispatch({type: 'SET_INITIALIZED', payload: true})
    }

    initializeMermaid()
  }, [])

  useEffect(() => {
    if (!state.isInitialized) return

    const renderDiagram = async () => {
      if (!containerRef.current || !safeDiagram.trim()) return

      try {
        const isValid = await mermaid.parse(safeDiagram)

        if (!isValid) {
          throw new Error('Invalid mermaid diagram syntax')
        }
        containerRef.current.innerHTML = ''

        // Render the diagram
        const {svg} = await mermaid.render(diagramId.current, safeDiagram)

        containerRef.current.innerHTML = svg

        // Get the SVG element for pan/zoom functionality
        const svgElement = containerRef.current.querySelector('svg')
        if (svgElement) {
          svgRef.current = svgElement
          // Store original SVG dimensions
          const bbox = svgElement.getBBox()
          const svgWidth = svgElement.width.baseVal.value || bbox.width
          const svgHeight = svgElement.height.baseVal.value || bbox.height

          dispatch({type: 'SET_ORIGINAL_SVG_SIZE', payload: {width: svgWidth, height: svgHeight}})

          // Only center the diagram if user hasn't interacted yet
          if (!state.hasUserInteracted) {
            const parentContainer = containerRef.current.parentElement
            if (parentContainer) {
              const containerWidth = parentContainer.offsetWidth
              const containerHeight = parentContainer.offsetHeight

              // Calculate scale to fit the diagram within the container with some padding
              const padding = 40
              const availableWidth = containerWidth - padding
              const availableHeight = containerHeight - padding

              const scaleX = availableWidth / svgWidth
              const scaleY = availableHeight / svgHeight
              const scale = Math.min(scaleX, scaleY) // Allow scaling to fit container

              // Calculate centered position with the scaled diagram
              const scaledWidth = svgWidth * scale
              const scaledHeight = svgHeight * scale

              dispatch({
                type: 'SET_TRANSFORM',
                payload: {
                  x: (containerWidth - scaledWidth) / 2,
                  y: (containerHeight - scaledHeight) / 2,
                  scale: scale,
                },
              })
            }
          }
        }
        setError(null)
      } catch (error) {
        console.error('Error rendering mermaid diagram:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        setError(errorMessage)
      }
    }

    renderDiagram()
  }, [safeDiagram, state.isInitialized, state.hasUserInteracted, setError])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dispatch({type: 'START_DRAG', payload: {x: e.clientX - state.transform.x, y: e.clientY - state.transform.y}})
      e.preventDefault()
    },
    [state.transform],
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!state.isDragging) return

      const newX = e.clientX - state.dragStart.x
      const newY = e.clientY - state.dragStart.y

      dispatch({
        type: 'UPDATE_TRANSFORM',
        payload: (prev) => {
          if (!containerRef.current || state.originalSvgSize.width === 0) {
            return {...prev, x: newX, y: newY}
          }

          const parentContainer = containerRef.current.parentElement
          if (!parentContainer) {
            return {...prev, x: newX, y: newY}
          }

          const containerWidth = parentContainer.offsetWidth
          const containerHeight = parentContainer.offsetHeight

          // Calculate the scaled dimensions of the diagram
          const scaledWidth = state.originalSvgSize.width * prev.scale
          const scaledHeight = state.originalSvgSize.height * prev.scale

          // Keep at least 50px of the diagram visible
          const minVisible = 50

          // Calculate constraints
          // Allow diagram to go mostly off-screen but keep minVisible pixels on screen
          const maxX = containerWidth - minVisible // Can go left until only 50px remains on right
          const minX = minVisible - scaledWidth // Can go right until only 50px remains on left
          const maxY = containerHeight - minVisible // Can go up until only 50px remains on bottom
          const minY = minVisible - scaledHeight // Can go down until only 50px remains on top

          // Apply constraints
          const constrainedX = Math.max(minX, Math.min(maxX, newX))
          const constrainedY = Math.max(minY, Math.min(maxY, newY))

          return {...prev, x: constrainedX, y: constrainedY}
        },
      })
    },
    [state.isDragging, state.dragStart, state.originalSvgSize],
  )

  const handleMouseUp = useCallback(() => {
    dispatch({type: 'STOP_DRAG'})
  }, [])

  // Handle document-level mouse events during dragging
  useEffect(() => {
    if (state.isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [state.isDragging, handleMouseMove, handleMouseUp])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      // Use smaller increments for smoother zooming (about 2.5% per scroll)
      const zoomSpeed = 0.025
      const delta = e.deltaY > 0 ? 1 - zoomSpeed : 1 + zoomSpeed
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      dispatch({
        type: 'UPDATE_TRANSFORM',
        payload: (prev) => {
          if (!containerRef.current || state.originalSvgSize.width === 0) return prev

          const parentContainer = containerRef.current.parentElement
          if (!parentContainer) return prev

          // Define zoom constraints
          const minZoom = 0.5 // 50% minimum zoom
          const maxZoom = 5 // 500% maximum zoom

          // Calculate new scale with constraints
          const newScale = Math.max(minZoom, Math.min(maxZoom, prev.scale * delta))

          // If we're already at the limit, don't change anything
          if (newScale === prev.scale) {
            return prev
          }

          const scaleRatio = newScale / prev.scale

          // Calculate new position after zoom
          let newX = mouseX - (mouseX - prev.x) * scaleRatio
          let newY = mouseY - (mouseY - prev.y) * scaleRatio

          // Apply pan constraints to keep diagram visible after zoom
          const containerWidth = parentContainer.offsetWidth
          const containerHeight = parentContainer.offsetHeight
          const scaledWidth = state.originalSvgSize.width * newScale
          const scaledHeight = state.originalSvgSize.height * newScale

          // Keep at least 50px of the diagram visible
          const minVisible = 50

          // Calculate constraints
          const maxX = containerWidth - minVisible
          const minX = minVisible - scaledWidth
          const maxY = containerHeight - minVisible
          const minY = minVisible - scaledHeight

          // Apply constraints
          newX = Math.max(minX, Math.min(maxX, newX))
          newY = Math.max(minY, Math.min(maxY, newY))

          return {x: newX, y: newY, scale: newScale}
        },
      })
    },
    [state.originalSvgSize],
  )

  const resetView = useCallback(() => {
    if (!containerRef.current || state.originalSvgSize.width === 0) return

    // Get the parent container (the interactive wrapper) dimensions
    const parentContainer = containerRef.current.parentElement
    if (!parentContainer) return

    // Use offsetWidth/offsetHeight for more accurate dimensions
    const containerWidth = parentContainer.offsetWidth
    const containerHeight = parentContainer.offsetHeight

    dispatch({type: 'RESET_VIEW', payload: {containerWidth, containerHeight}})
  }, [state.originalSvgSize])

  const zoomIn = useCallback(() => {
    if (!containerRef.current || state.originalSvgSize.width === 0) return

    const parentContainer = containerRef.current.parentElement
    if (!parentContainer) return

    const containerWidth = parentContainer.offsetWidth
    const containerHeight = parentContainer.offsetHeight
    const centerX = containerWidth / 2
    const centerY = containerHeight / 2

    dispatch({
      type: 'UPDATE_TRANSFORM',
      payload: (prev) => {
        const zoomFactor = 1.2 // 20% zoom in
        const newScale = Math.min(5, prev.scale * zoomFactor) // Max 500% zoom

        if (newScale === prev.scale) return prev

        const scaleRatio = newScale / prev.scale

        // Zoom towards center of viewport
        const newX = centerX - (centerX - prev.x) * scaleRatio
        const newY = centerY - (centerY - prev.y) * scaleRatio

        return {x: newX, y: newY, scale: newScale}
      },
    })
  }, [state.originalSvgSize])

  const zoomOut = useCallback(() => {
    if (!containerRef.current || state.originalSvgSize.width === 0) return

    const parentContainer = containerRef.current.parentElement
    if (!parentContainer) return

    const containerWidth = parentContainer.offsetWidth
    const containerHeight = parentContainer.offsetHeight
    const centerX = containerWidth / 2
    const centerY = containerHeight / 2

    dispatch({
      type: 'UPDATE_TRANSFORM',
      payload: (prev) => {
        const zoomFactor = 0.8 // 20% zoom out
        const newScale = Math.max(0.5, prev.scale * zoomFactor) // Min 50% zoom

        if (newScale === prev.scale) return prev

        const scaleRatio = newScale / prev.scale

        // Zoom towards center of viewport
        const newX = centerX - (centerX - prev.x) * scaleRatio
        const newY = centerY - (centerY - prev.y) * scaleRatio

        return {x: newX, y: newY, scale: newScale}
      },
    })
  }, [state.originalSvgSize])

  if (!state.isInitialized) {
    return <div className={className}>Loading diagram...</div>
  }

  return (
    <div
      className={`${className} relative overflow-hidden`}
      style={{
        width: '100%',
        height: '100%',
        cursor: state.isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
    >
      <div
        ref={containerRef}
        style={{
          transform: `translate(${state.transform.x}px, ${state.transform.y}px) scale(${state.transform.scale})`,
          transformOrigin: '0 0',
          transition: state.isDragging ? 'none' : 'transform 0.1s ease-out',
          position: 'absolute',
          top: 0,
          left: 0,
          display: 'inline-block',
        }}
      />

      <div className="absolute right-2 bottom-2 left-2 flex justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={zoomIn}
            className="h-8 w-8 rounded border border-neutral-600 bg-neutral-900 px-2 py-1 text-sm text-white hover:border-neutral-500"
            title="Zoom In"
          >
            <ClarityPlusLine />
          </button>
          <button
            type="button"
            onClick={zoomOut}
            className="h-8 w-8 rounded border border-neutral-600 bg-neutral-900 px-2 py-1 text-sm text-white hover:border-neutral-500"
            title="Zoom Out"
          >
            <ClarityMinusLine />
          </button>
        </div>

        <button
          type="button"
          onClick={resetView}
          className="h-8 w-8 rounded border border-neutral-600 bg-neutral-900 px-2 py-1 text-sm text-white hover:border-neutral-500"
        >
          <StreamlineInterfacePageControllerFitScreenFitScreenAdjustDisplayArtboardFrameCorner />
        </button>
      </div>
    </div>
  )
})
