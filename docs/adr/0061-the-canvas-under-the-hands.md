# 0061 — The canvas under the hands

**Status**: Accepted — 2026-09-08

## Context

Fase 7 of the preparatory plan lists ten things the canvas was missing.
They are not features in the sense the earlier phases were — nothing here
lets a site do something it could not do before. They are the difference
between an editor somebody can use all day and one they can use for a
demo.

This decision covers six of them. The four that remain — multi-select,
reparenting from the Layers panel, dragging a nested block on the canvas,
and merging the two style popovers — are named at the end.

## Decision

### Copy and paste use the editor's own clipboard, not the system one

`Cmd+C` puts the selected block in React state; `Cmd+V` inserts a copy
beside the selection.

Not `navigator.clipboard`. Reading the system clipboard needs a permission
prompt, and writing a block to it means serialising the block tree as
text — so the next time that person pastes into an email they get a wall
of JSON. The thing being copied is a **block**, and the only place a block
means anything is this editor.

The cost is real and accepted: the clipboard does not survive a reload,
and it cannot carry a block to another browser tab. What it does carry it
across is pages, which is the case that actually comes up.

Every paste calls `cloneBlockWithNewIds` — the function Duplicate already
used. Two pastes of one copied block must not share ids: those key the
per-instance style rule and the translation overlay, so a style set on the
second copy would land on both.

### `Alt`+Arrow moves a block; a bare arrow still scrolls

The arrows scroll a page, and taking that away from somebody reading a
long one so they can nudge a block is the wrong trade. `Alt` is what an
editor with a tree usually binds this to.

`Delete` and `Backspace` both remove the selection, and every shortcut is
skipped while the focus is in one of the editor's own inputs — `Delete`
has to delete a character there. Text editing **on the canvas** is not
this listener's problem at all: it happens inside the sandboxed iframe, a
separate document whose key events never reach the parent.

### The shortcuts read through a ref, and the ref is written in an effect

The listener is attached once, with an empty dependency list. Undo and
redo could already get away with that because they read current state at
call time; the shortcuts added here cannot — they close over the selected
block and the tree, and a stale closure would delete the block that WAS
selected three renders ago.

So they go through a ref, and the ref is written **in an effect** rather
than during render: React forbids touching a ref while rendering and the
linter enforces it. Safe, because the listener only fires on a real key
press, which cannot happen before the first effect has run.

### `radio` is a radio group, and `select` is a dropdown

They used to fall through to the same `<select>`, so a descriptor could
say `radio` and get a dropdown — the difference existed only in the type.
They are not interchangeable: a radio group shows every option at once,
which is what a three-way choice like a Container's padding wants, while
a dropdown hides all but one, which is what a sixty-item list needs.

The group's `name` is scoped to the field **and the block**: two blocks of
the same type on one page would otherwise share a radio group, and picking
on one would clear the other.

### The breadcrumb is a trail, and every step of it selects

It was the selected block's own label — a label pretending to be a
breadcrumb. It is the ancestor chain now, and each step selects that
ancestor. A block inside a Column inside a Columns was otherwise
reachable only by hunting for a pixel its children did not already cover,
which is the whole reason the Layers panel had to grow click-to-select in
the first place.

### The picker has a search box, and it opens what it finds

Fifty-three insertable types in collapsed accordion sections meant finding
one required knowing which category somebody had filed it under.

The search matches the **translated label and the type name** both:
somebody reading the UI types "Immagine", somebody reading the docs types
"Image", and matching only one of the two is a search that works if you
already knew where to look. While searching, the matching sections are
forced open — a search that found three blocks and left them behind
collapsed sections would look like a search that found nothing.

### The custom fields join the design system

Seven of them carried inline styles with literal hex values —
`background: '#fff'`, `color: '#18181b'`, `1px solid #d4d4d8` — and four
carried Italian strings hardcoded in the markup.

The colours were not merely untidy: they are a white box with near-black
text, correct in the light theme and unreadable in the dark one, where the
panel around them is dark. They read the same tokens every other control
does now, and the strings go through i18n like the rest of the app.

## Consequences

- Seven keyboard shortcuts where there were two.
- The four items still open are the heavier half, and one of them —
  multi-select — the plan itself calls a change of model rather than an
  addition: the bridge carries a single `selectedBlockId` today, and
  every overlay, toolbar and mutation reads it. Reparenting from the
  Layers panel and dragging a nested block on the canvas are both real
  work in `compute-drop-target.ts`; merging the two style popovers is a
  question about what the Inspector should be, not a fix.
