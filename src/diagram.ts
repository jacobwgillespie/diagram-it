import mermaid from 'mermaid'

interface GenerateDiagramOptions {
  prompt: string
  currentDiagram?: string
  diagnosticError?: string | null
  onAttempt?: (attempt: number) => void
}

interface GenerateDiagramResult {
  success: boolean
  diagram?: string
  error?: string
  attempts?: number
}

interface GenerateDiagramStreamingOptions {
  prompt: string
  currentDiagram?: string
  onToken?: (chunk: string, fullText: string) => void
  onDiagramUpdate?: (diagram: string) => void
  onAttempt?: (attempt: number) => void
}

export async function generateDiagramStreaming(
  options: GenerateDiagramStreamingOptions,
): Promise<GenerateDiagramResult> {
  const {prompt, currentDiagram = '', onToken, onDiagramUpdate, onAttempt} = options

  onAttempt?.(1)
  let fullResponse = ''
  let currentDiagramContent = ''

  try {
    // Build the input value with request and current diagram
    let inputValue = `<Request>${prompt}</Request>`

    if (currentDiagram.trim()) {
      inputValue += `\n<Diagram>${currentDiagram}</Diagram>`
    }

    const requestBody = {
      input_value: inputValue,
      output_type: 'chat',
      input_type: 'chat',
    }

    const response = await fetch('http://localhost:7868/api/v1/run/ea686fb5-9bec-479a-b58e-d786a10752cf?stream=true', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body reader available')
    }

    const decoder = new TextDecoder()

    while (true) {
      const {done, value} = await reader.read()

      if (done) break

      const chunk = decoder.decode(value, {stream: true})
      const lines = chunk.split('\n').filter((line) => line.trim())

      for (const line of lines) {
        try {
          const event = JSON.parse(line)

          if (event.event === 'token' && event.data?.chunk) {
            const tokenChunk = event.data.chunk
            fullResponse += tokenChunk
            onToken?.(tokenChunk, fullResponse)

            // Check if we're entering or inside a diagram block
            if (fullResponse.includes('<Diagram>')) {
              // Extract everything after <Diagram>
              const diagramStart = fullResponse.lastIndexOf('<Diagram>') + '<Diagram>'.length
              const diagramEnd = fullResponse.indexOf('</Diagram>', diagramStart)

              if (diagramEnd === -1) {
                // Still building the diagram
                currentDiagramContent = fullResponse.substring(diagramStart).trim()
              } else {
                // Complete diagram found
                currentDiagramContent = fullResponse.substring(diagramStart, diagramEnd).trim()
              }

              // Update the diagram in real-time if we have content
              if (currentDiagramContent && onDiagramUpdate) {
                onDiagramUpdate(currentDiagramContent)
              }
            }
          }
        } catch (parseError) {
          // Skip malformed JSON lines
        }
      }
    }

    // Final extraction of diagram
    const diagramMatch = fullResponse.match(/<Diagram>([\s\S]*?)<\/Diagram>/)

    if (diagramMatch?.[1]) {
      const finalDiagram = diagramMatch[1].trim()
      return {
        success: true,
        diagram: finalDiagram,
        attempts: 1,
      }
    }
    throw new Error('No complete diagram found in response')
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to generate diagram',
      attempts: 1,
    }
  }
}

export async function generateDiagram(options: GenerateDiagramOptions): Promise<GenerateDiagramResult> {
  const {prompt, currentDiagram = '', diagnosticError = null, onAttempt} = options

  const maxAttempts = 5
  let attempts = 0
  let currentDiagramToSend = currentDiagram
  let lastDiagnosticError = diagnosticError

  while (attempts < maxAttempts) {
    attempts++
    onAttempt?.(attempts)

    try {
      // Build the input value with request, current diagram, and diagnostics if any
      let inputValue = `<Request>${prompt}</Request>`

      if (currentDiagramToSend.trim()) {
        inputValue += `\n<Diagram>${currentDiagramToSend}</Diagram>`
      }

      if (lastDiagnosticError) {
        inputValue += `\n<Diagnostics>${lastDiagnosticError}</Diagnostics>`
      }

      const requestBody = {
        input_value: inputValue,
        output_type: 'chat',
        input_type: 'chat',
      }

      const response = await fetch(
        'http://localhost:7868/api/v1/run/ea686fb5-9bec-479a-b58e-d786a10752cf?stream=false',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
      )

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`)
      }

      const data = await response.json()

      // Extract the diagram from the response
      const messageText = data.outputs?.[0]?.outputs?.[0]?.results?.message?.text || ''
      const diagramMatch = messageText.match(/<Diagram>([\s\S]*?)<\/Diagram>/)

      if (diagramMatch?.[1]) {
        const newDiagram = diagramMatch[1].trim()
        currentDiagramToSend = newDiagram

        // Validate the new diagram
        try {
          mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            securityLevel: 'loose',
            fontFamily: 'inherit',
          })

          const isValid = await mermaid.parse(newDiagram)

          if (isValid) {
            // Success!
            return {
              success: true,
              diagram: newDiagram,
              attempts,
            }
          }
        } catch (validationErr) {
          // Diagram has errors, prepare for retry
          lastDiagnosticError = validationErr instanceof Error ? validationErr.message : 'Invalid diagram syntax'

          if (attempts === maxAttempts) {
            return {
              success: false,
              error: `Failed after ${maxAttempts} attempts. Last error: ${lastDiagnosticError}`,
              attempts,
            }
          }
        }
      } else {
        throw new Error('No diagram found in API response')
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to generate diagram',
        attempts,
      }
    }
  }

  // Should not reach here, but just in case
  return {
    success: false,
    error: 'Maximum attempts reached',
    attempts,
  }
}
