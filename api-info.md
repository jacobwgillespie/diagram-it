# API Info

## Run

```bash
curl --request POST \
  --url 'http://localhost:7868/api/v1/run/ea686fb5-9bec-479a-b58e-d786a10752cf?stream=false' \
  --header 'Content-Type: application/json' \
  --data '{
  "input_value": "<Request>Sequence diagram of a TLS handshake</Request>",
  "output_type": "chat",
  "input_type": "chat"
}'
```

## Response

```json
{
  "session_id": "ea686fb5-9bec-479a-b58e-d786a10752cf",
  "outputs": [
    {
      "inputs": {"input_value": "<Request>Sequence diagram of a TLS handshake</Request>"},
      "outputs": [
        {
          "results": {
            "message": {
              "text_key": "text",
              "data": {
                "timestamp": "2025-06-20 19:12:27 UTC",
                "sender": "Machine",
                "sender_name": "AI",
                "session_id": "ea686fb5-9bec-479a-b58e-d786a10752cf",
                "text": "<Diagram>\nsequenceDiagram\n    participant Client\n    participant Server\n\n    Client->>Server: ClientHello\n    Server->>Client: ServerHello, Certificate, ServerHelloDone\n    Client->>Server: ClientKeyExchange, ChangeCipherSpec, Finished\n    Server->>Client: ChangeCipherSpec, Finished\n</Diagram>",
                "files": [],
                "error": false,
                "edit": false,
                "properties": {
                  "text_color": "",
                  "background_color": "",
                  "edited": false,
                  "source": {"id": "MistralModel-1oeOp", "display_name": "MistralAI", "source": "codestral-latest"},
                  "icon": "MistralAI",
                  "allow_markdown": false,
                  "positive_feedback": null,
                  "state": "complete",
                  "targets": []
                },
                "category": "message",
                "content_blocks": [],
                "id": "1a06006a-6760-4be3-95d6-4d84ad0760e6",
                "flow_id": "ea686fb5-9bec-479a-b58e-d786a10752cf",
                "duration": null
              },
              "default_value": "",
              "text": "<Diagram>\nsequenceDiagram\n    participant Client\n    participant Server\n\n    Client->>Server: ClientHello\n    Server->>Client: ServerHello, Certificate, ServerHelloDone\n    Client->>Server: ClientKeyExchange, ChangeCipherSpec, Finished\n    Server->>Client: ChangeCipherSpec, Finished\n</Diagram>",
              "sender": "Machine",
              "sender_name": "AI",
              "files": [],
              "session_id": "ea686fb5-9bec-479a-b58e-d786a10752cf",
              "timestamp": "2025-06-20T19:12:27+00:00",
              "flow_id": "ea686fb5-9bec-479a-b58e-d786a10752cf",
              "error": false,
              "edit": false,
              "properties": {
                "text_color": "",
                "background_color": "",
                "edited": false,
                "source": {"id": "MistralModel-1oeOp", "display_name": "MistralAI", "source": "codestral-latest"},
                "icon": "MistralAI",
                "allow_markdown": false,
                "positive_feedback": null,
                "state": "complete",
                "targets": []
              },
              "category": "message",
              "content_blocks": [],
              "duration": null
            }
          },
          "artifacts": {
            "message": "<Diagram>\n\nsequenceDiagram\n\n    participant Client\n\n    participant Server\n\n    Client->>Server: ClientHello\n\n    Server->>Client: ServerHello, Certificate, ServerHelloDone\n\n    Client->>Server: ClientKeyExchange, ChangeCipherSpec, Finished\n\n    Server->>Client: ChangeCipherSpec, Finished\n\n</Diagram>",
            "sender": "Machine",
            "sender_name": "AI",
            "files": [],
            "type": "object"
          },
          "outputs": {
            "message": {
              "message": "<Diagram>\nsequenceDiagram\n    participant Client\n    participant Server\n\n    Client->>Server: ClientHello\n    Server->>Client: ServerHello, Certificate, ServerHelloDone\n    Client->>Server: ClientKeyExchange, ChangeCipherSpec, Finished\n    Server->>Client: ChangeCipherSpec, Finished\n</Diagram>",
              "type": "text"
            }
          },
          "logs": {"message": []},
          "messages": [
            {
              "message": "<Diagram>\n\nsequenceDiagram\n\n    participant Client\n\n    participant Server\n\n    Client->>Server: ClientHello\n\n    Server->>Client: ServerHello, Certificate, ServerHelloDone\n\n    Client->>Server: ClientKeyExchange, ChangeCipherSpec, Finished\n\n    Server->>Client: ChangeCipherSpec, Finished\n\n</Diagram>",
              "sender": "Machine",
              "sender_name": "AI",
              "session_id": "ea686fb5-9bec-479a-b58e-d786a10752cf",
              "stream_url": null,
              "component_id": "ChatOutput-P98JM",
              "files": [],
              "type": "text"
            }
          ],
          "timedelta": null,
          "duration": null,
          "component_display_name": "Chat Output",
          "component_id": "ChatOutput-P98JM",
          "used_frozen_result": false
        }
      ]
    }
  ]
}
```

## Model instructions

```
You will be given information about a mermaid diagram that the user wishes to either generate or edit.

## Input format

The user will input their request in the format:

<Request> ... text input from the user ... </Request>

If they have an existing diagram that they are working on, its code will come in the format:

<Diagram> ... mermaid code ... </Diagram>

Sometimes you will be given an existing diagram + diagnostics like this:

<Diagnostics> ... diagnostic information, like rendering errors ... </Diagnostics>

When given diagnostics, this means that the diagram being sent did not render correctly and should be fixed.

## Output format

You MUST reply with a valid renderable mermaid diagram code, either generating the requested diagram or modifying the existing one as is fit, in the same format:

<Diagram> ... new mermaid code ... </Diagram>

## Important notes

Please only reply with the resulting diagram, the user will not see any other output.
```
