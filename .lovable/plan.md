

## Fix: Prevent auto-scroll when reading older messages

**Problem:** Every 5-second refresh calls `scrollToBottom()` via the `useEffect` on `[messages]`, forcing the user down even when reading older messages.

**Solution in `src/components/ChatView.tsx`:**

1. Add a `isNearBottom` ref that tracks whether the user is scrolled near the bottom of the chat.
2. Attach an `onScroll` handler to the `ScrollArea` viewport to update this ref — consider "near bottom" if within ~100px of the bottom.
3. Change `scrollToBottom` in the `useEffect([messages])` to only scroll if `isNearBottom` is true.
4. On initial load (`loadMessages`), always scroll to bottom.

This way, the 5-second auto-refresh updates messages without jumping the scroll position, unless the user is already at the bottom.

