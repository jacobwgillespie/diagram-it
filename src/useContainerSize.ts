import {useEffect, useRef, useState} from 'react'

interface ContainerSize {
  width: number
  height: number
}

export function useContainerSize(): [React.RefObject<HTMLElement>, ContainerSize] {
  const ref = useRef<HTMLElement>(null)
  const [size, setSize] = useState<ContainerSize>({width: 0, height: 0})

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const updateSize = () => {
      setSize({
        width: element.offsetWidth,
        height: element.offsetHeight,
      })
    }

    // Initial measurement
    updateSize()

    // Use ResizeObserver for efficient size tracking
    const resizeObserver = new ResizeObserver(() => {
      updateSize()
    })

    resizeObserver.observe(element)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  return [ref, size]
}