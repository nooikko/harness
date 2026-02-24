# Chat Input Feature Design

## Goal

Add a chat input to the web dashboard so the user can send messages in threads and receive AI responses via the orchestrator's full plugin pipeline.

## Architecture

The Next.js dashboard communicates with the orchestrator (running on a separate port) via its existing REST API and WebSocket. A server action sends messages to `POST /api/chat` on the orchestrator's web plugin. A client-side WebSocket connection listens for `pipeline:complete` events and triggers `router.refresh()` to re-fetch the message list from the database.

## Decisions

- **Connection method:** Server Action → Orchestrator API (not direct Claude calls or DB queue)
- **Real-time updates:** WebSocket from orchestrator's existing broadcaster
- **New threads:** Supported — "New Chat" button creates a thread and navigates to it
- **Message persistence:** Server action writes user message to DB immediately for optimistic display
- **Response display:** "Thinking..." indicator until WebSocket event, then router.refresh()

## Component Architecture

### ChatInput (client component)
- Text area + send button at the bottom of the thread detail page
- Submit on Enter, Shift+Enter for newline
- Disabled while waiting for response (between send and pipeline:complete)
- Shows inline "thinking..." indicator after sending

### WsProvider (client component, context)
- Lives in the `(chat)` layout, wraps all chat children
- Connects to `ws://${NEXT_PUBLIC_ORCHESTRATOR_URL}/ws` on mount
- Exposes `useWs()` hook for subscribing to specific events
- Auto-reconnects on disconnect
- Shows subtle "disconnected" indicator when connection is lost

### MessageRefresh (client component)
- Wraps the message list area
- Subscribes to `pipeline:complete` events filtered by current threadId
- Calls `router.refresh()` when a matching event arrives
- Clears the "thinking" state

### NewThreadButton (client component)
- Appears in the thread sidebar
- Calls server action to create a Thread (source: "web", kind: "general", status: "open")
- Navigates to the new thread via `router.push()`
- Sidebar refreshes via revalidatePath

## Data Flow

### Sending a message
1. User types in ChatInput, presses Enter
2. ChatInput calls `sendMessage(threadId, content)` server action
3. Server action writes user message to DB (role: "user")
4. Server action POSTs to orchestrator `POST /api/chat` with `{ threadId, content }`
5. Server action calls `revalidatePath` to refresh message list
6. User message appears immediately in the list

### Receiving a response
1. Orchestrator processes message through pipeline (context → Claude → commands)
2. Orchestrator persists assistant message to DB
3. Orchestrator broadcasts `pipeline:complete` via WebSocket
4. WsProvider receives event, MessageRefresh filters by threadId
5. `router.refresh()` re-fetches message list — assistant response appears

### Creating a new thread
1. User clicks "New Chat" in sidebar
2. Server action creates Thread record in DB
3. `router.push(/chat/{id})` navigates to new thread
4. `revalidatePath` refreshes sidebar thread list

## Error Handling

- **Orchestrator offline:** Server action catches fetch error, returns error. Input shows inline message.
- **WebSocket disconnected:** Provider shows subtle indicator. Sending still works, responses won't auto-appear until reconnect.
- **Long responses:** "Thinking..." stays until pipeline:complete. No client timeout.

## Files

### New
- `(chat)/chat/_components/chat-input.tsx` — client: textarea + send
- `(chat)/chat/_actions/send-message.ts` — server action: DB write + orchestrator POST
- `(chat)/chat/_actions/create-thread.ts` — server action: create thread
- `(chat)/chat/_components/ws-provider.tsx` — client: WebSocket context
- `(chat)/chat/_components/new-thread-button.tsx` — client: sidebar button
- `(chat)/chat/_components/message-refresh.tsx` — client: WS listener + refresh
- `__tests__/` for each

### Modified
- `(chat)/chat/[thread-id]/page.tsx` — add ChatInput below MessageList
- `(chat)/chat/_components/thread-sidebar.tsx` — add NewThreadButton
- `(chat)/layout.tsx` — wrap children in WsProvider

## Environment
- `NEXT_PUBLIC_ORCHESTRATOR_URL` — orchestrator host:port (default: `localhost:4001`)
