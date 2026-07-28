# mock-repo

Fixture content for md-reader's mock mode and automated screenshots. It
exercises every GFM feature the renderer claims to support.

![logo](img/logo.png)

## Features

- **Bold**, *italic*, ~~strikethrough~~, `inline code`
- Autolink: https://example.com
- Relative link: [the guide](docs/guide.md), [notes](docs/notes.md)
- Anchor link: [jump to tasks](#tasks)

## Tables

| Feature | Status | Notes |
|---|---|---|
| Tables | done | pipes and alignment |
| Task lists | done | disabled checkboxes |
| Alerts | done | all five kinds |

## Tasks

- [x] render markdown
- [x] highlight code
- [ ] watch files for changes (deferred to v2)

## Code

```js
export function greet(name) {
  const msg = `hello, ${name}`;
  return msg.toUpperCase();
}
```

```python
def fib(n: int) -> int:
    return n if n < 2 else fib(n - 1) + fib(n - 2)
```

## Alerts

> [!NOTE]
> Useful information that users should know, even when skimming.

> [!TIP]
> Helpful advice for doing things better or more easily.

> [!IMPORTANT]
> Key information users need to know to achieve their goal.

> [!WARNING]
> Urgent info that needs immediate user attention to avoid problems.

> [!CAUTION]
> Advises about risks or negative outcomes of certain actions.

## Blockquote

> A plain blockquote stays a blockquote — only `[!TYPE]` markers become alerts.
