# Audit Plugin — Developer Notes

## Overview

Single-hook plugin. Implements `onBroadcast`. Read `src/index.ts` and `src/_helpers/build-extraction-prompt.ts` before editing.

---

## Trigger path

```
Browser: clicks "Audit & Delete"
  → server action: requestAuditDelete(threadId)
  → fetch POST /api/audit-delete (fire-and-forget)
  → web plugin routes.ts: ctx.broadcast('audit:requested', { threadId })
  → audit plugin onBroadcast fires
```

The HTTP route is in `packages/plugins/web/src/_helpers/routes.ts`. The server action is in `apps/web/src/app/(chat)/chat/_actions/request-audit-delete.ts`.

---

## ThreadAudit is not a foreign key

```prisma
model ThreadAudit {
  id       String @id
  threadId String   // plain String — NOT @relation
  ...
}
```

This is intentional. If `threadId` were a foreign key with `onDelete: Cascade`, the audit record would be deleted when the thread is deleted — defeating the entire purpose. The `threadId` field is a reference string only. Do not add a `@relation` here.

---

## Duplicate guard

```typescript
const recent = await ctx.db.threadAudit.findFirst({
  where: {
    threadId,
    extractedAt: { gte: new Date(Date.now() - 60_000) },
  },
});
if (recent) return;
```

This prevents double-extraction if `audit:requested` is broadcast twice in quick succession (e.g., user double-clicks, or two clients send the request). The 60-second window should be wider than the typical extraction time (~5-15 seconds with Haiku). If you increase the window, be aware it will delay retries after a genuine failure.

---

## Failure handling

If the invocation or DB write throws, the plugin:
1. Logs at `error` level
2. Broadcasts `audit:failed { threadId, reason }`
3. Does NOT delete the thread

The thread is only deleted after the `ThreadAudit` record is successfully written. If you reverse this order (delete first, write audit second), a failure after deletion would silently lose both the thread and the extraction. The current order is the safe one.

The browser does not currently render `audit:failed` — it is available for a future UI error state.

---

## Child thread detachment

```typescript
await ctx.db.thread.updateMany({
  where: { parentThreadId: threadId },
  data: { parentThreadId: null },
});
await ctx.db.thread.delete({ where: { id: threadId } });
```

Task threads (created by the delegation plugin) have a `parentThreadId` pointing to their parent. Prisma's self-referential relation does not auto-cascade on parent deletion. Without the `updateMany` call, deleting the parent would leave orphaned child threads with a dangling FK reference that may cause errors.

After detachment, child threads remain in the database as standalone threads. They are not deleted as part of the audit.

---

## Message cap

```typescript
take: 200,
```

Only `kind: 'text'` messages from `user` and `assistant` roles are loaded. Pipeline status messages, thinking blocks, tool calls, and summary messages are excluded. The 200-message cap prevents token overflow on very long threads. Oldest messages (by `createdAt asc`) are included first; if the thread has more than 200 text messages, the most recent ones are dropped from the extraction.

If the cap is too low for your use case, increase it — but also consider whether the extraction prompt needs to be adjusted for very long inputs.

---

## Broadcast events emitted

| Event | When | Data |
|-------|------|------|
| `thread:deleted` | After successful delete | `{ threadId }` |
| `audit:failed` | On any unhandled error | `{ threadId, reason }` |

The `thread:deleted` event is also emitted by `delete-thread.ts` (direct delete path) — both paths use the same event name so the browser handler is unified.
