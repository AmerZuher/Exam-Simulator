# Sample media

Used by **ExamPro Feature Showcase.md**.

| File | What it demonstrates |
|------|----------------------|
| `diagram.svg` | An image attached with `![alt](path)` |
| `tone.wav` | Audio attached with `[audio: path]` |
| `intro.mp4` | **Not included** — drop any short `.mp4` here to see the video player |

`intro.mp4` is deliberately absent so you can see the graceful-failure
behaviour: a question whose media cannot load simply hides that media instead of
showing a broken frame. Drop any short video in as `intro.mp4` and re-import the
bank to see the player appear.

Paths inside a bank resolve from the **app root**, not from the markdown file —
which is why the showcase writes `Exams/media/diagram.svg`.
