# ExamPro — Feature Showcase

A working question bank that also documents every format the importer understands.
Import it, then open the **Study → Q&A preview** to see how each question was parsed.

---

### 1. Single choice: which page runs a timed, scored simulation?

- [ ] The Study page
- [ ] The Exam page
- [ ] The Import page
- [ ] The Progress page

### 2. True or False: revealing an answer on the Study page changes your review schedule.

- [ ] True
- [ ] False

### 3. Select all that apply: which of these does the Progress page show?

- [ ] Score by attempt
- [ ] A study-activity heatmap
- [ ] Upcoming review forecast
- [ ] Your browser history
- [ ] Weak spots you keep missing

### 4. Choose two: which grades push a card further into the future?

- [ ] Again
- [ ] Hard
- [ ] Good
- [ ] Easy

### 5. Matching: match each page with what it is for.

- [ ] Exam
- [ ] Study
- [ ] Review
- [ ] Progress

Definition A: Timed, scored simulation with a countdown
Definition B: Questions and answers side by side
Definition C: One card at a time, graded by recall
Definition D: Trends, retention and weak spots

### 6. Options can be referenced by letter in the key. Which one is correct here?

- [ ] Alpha
- [ ] Bravo
- [ ] Charlie
- [ ] Delta

### 7. Answers containing commas are not split on the comma. Which describes an OBS?

- [ ] A unit, its descendants, and its ancestors
- [ ] A single project only
- [ ] A financial period
- [ ] A resource rate matrix

### 8. Choose the right word with the definition: the interval multiplier SM-2 adjusts each time you grade a card.

- [ ] Ease factor
- [ ] Lapse count
- [ ] Retention rate
- [ ] Pass threshold

### Answer Key

| Question Number | Correct Answer |
| :-------------- | :------------- |
| 1 | The Exam page |
| 2 | False |
| 3 | • Score by attempt <br>• A study-activity heatmap <br>• Upcoming review forecast <br>• Weak spots you keep missing |
| 4 | • Good <br>• Easy |
| 5 | Exam, Study, Review, Progress |
| 6 | C |
| 7 | A unit, its descendants, and its ancestors |
| 8 | Ease factor |

---

# Section two — a second document block

A new `### 1.` heading appearing *after* an answer key starts a fresh block, so
numbering may restart. Both blocks end up in the same bank, renumbered
sequentially.

### 1. This question is numbered 1 again, and that is fine.

- [ ] The importer merges blocks and renumbers them
- [ ] The importer throws an error
- [ ] Only the first block is kept

### 2. Which answer-key styles does the parser accept?

- [ ] A markdown table
- [ ] A `- Q1: answer` list
- [ ] Letters like `B` or `c)`
- [ ] Only one fixed format

### Answer Key

- Q1: The importer merges blocks and renumbers them
- Q2: • A markdown table <br>• A `- Q1: answer` list <br>• Letters like `B` or `c)`

---

# Section three — media

Images, video and audio attach to the question they sit under. All are optional,
and anything that fails to load hides itself rather than leaving a broken frame.

**Paths resolve from the app root, not from this file** — hence the `Exams/`
prefix below.

### 1. Media: an image attaches with standard markdown image syntax.

![Spaced repetition intervals](Exams/media/diagram.svg)

- [ ] Yes — the image renders above the options
- [ ] No — images are stripped out

### 2. Media: audio attaches with an `[audio: file]` tag.

[audio: Exams/media/tone.wav]

- [ ] Yes — the card renders a player
- [ ] No — audio is unsupported

### 3. Media: video attaches the same way, with a `[video: file]` tag.

[video: Exams/media/intro.mp4]

- [ ] Yes — an inline player appears
- [ ] No — only images and audio work

### Answer Key

| Question Number | Correct Answer |
| :-- | :-- |
| 1 | Yes — the image renders above the options |
| 2 | Yes — the card renders a player |
| 3 | Yes — an inline player appears |

---

## Format reference

**Question heading** — two to five `#`, a number, then `.` or `)`:

```
### 12. Your question text
```

**Options** — `- [ ]`, or a plain `-`, `*`, `+` bullet:

```
- [ ] First option
- [ ] Second option
```

**Matching** — options are the things to choose from; `Definition X:` lines are
the prompts. List the answers in definition order, comma-separated:

```
### 5. Matching: pair them up.
- [ ] Choice one
- [ ] Choice two
Definition A: first prompt
Definition B: second prompt
```

**Answer key** — a table, or a list. Multiple answers are separated by bullets
(`•`) or `<br>`, never by commas, so answers may safely contain commas:

```
| 3 | • First answer <br>• Second answer |
- Q3: • First answer <br>• Second answer
```

**Type detection** — one answer is single choice; more than one, or a phrase
like *select all that apply* / *choose two*, makes it multi-choice; any
`Definition X:` line makes it matching. True/False is just a single-choice
question with two options.

**Media** — three kinds, all optional, all attaching to the question above them.
Paths resolve from the app root:

```
![alt text](Exams/media/diagram.svg)     image  — or <img src="...">
[audio: Exams/media/tone.wav]            audio  — or <audio src="...">
[video: Exams/media/intro.mp4]           video  — or <video src="...">
```

Recognised extensions: images anything the browser renders; audio `mp3` `wav`
`ogg` `oga` `m4a` `aac` `flac` `webm`; video `mp4` `webm` `ogv` `mov` `m4v`.
A question may carry several of each, and they render image → video → audio.
