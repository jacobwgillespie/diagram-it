## `resetDiagram`

If the user asks to "reset everything", "start over", "clear the diagram" or similar, this tool will reset their diagram back to a clean state and be ready for the next updateDiagram.

## `updateDiagram`

This will update the diagram that the user sees on their screen, given their request.

- `userRequest` - The instructions about the diagram to be generated or modified that the user has spoken should be passed here. This will be analyzed by another agent and converted into the digram that the user can see on their screen. You should more or less pass what the user asked for verbatim.
