import {useEffect, useRef, useState, useCallback} from 'react'

interface ContainerSize {
  width: number
  height: number
}

export function useContainerSize(): [React.RefObject<HTMLElement>, ContainerSize] {
  const ref = useRef<HTMLElement>(null)
  const [size, setSize] = useState<ContainerSize>({width: 0, height: 0})

  const updateSize = useCallback(() => {
    const element = ref.current
    if (!element) return

    const newSize = {
      width: element.offsetWidth,
      height: element.offsetHeight,
    }
    setSize(prevSize => {
      if (prevSize.width !== newSize.width || prevSize.height !== newSize.height) {
        return newSize
      }
      return prevSize
    })
  }, [])

  useEffect(() => {
    const element = ref.current
    if (!element) return

    // Initial measurement with a small delay to ensure element is rendered
    const timeoutId = setTimeout(updateSize, 0)

    // Use ResizeObserver for efficient size tracking
    const resizeObserver = new ResizeObserver(() => {
      updateSize()
    })

    resizeObserver.observe(element)

    return () => {
      clearTimeout(timeoutId)
      resizeObserver.disconnect()
    }
  }, [updateSize])

  return [ref, size]
}
