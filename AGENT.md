# AGENT.md

This repository is **not an application repo**.
It is an **E2E testing library repo** built around Stagehand + Vitest.

That single fact should shape almost every implementation and review decision.

## What this repo is

Voreux is a library for authoring E2E tests.
The `examples/` directories are not product features; they are a mix of:

- executable examples
- authoring references
- regression coverage for tricky UI patterns
- documentation by code

A sample here is often expected to teach, not just pass.

## What this repo is not

Do **not** treat this repo like:

- a normal application repo
- a backend service repo
- a UI product repo
- a generic component library repo

That means common app-repo heuristics may be wrong here.

Examples:

- A package used only by example tests may still be intentionally kept as a regular dependency in that example package if it makes the example easier to run and understand.
- Helper files may contain more commentary than production code because they double as authoring guidance.
- A little duplication can be preferable when it makes a sample easier to read.

## Most important runtime fact: `ctx.page` is not Playwright full API

When working in this repo, assume `ctx.page` is a **Stagehand-style page object**, not raw Playwright `Page`.

### Prefer

- `ctx.page.goto(...)`
- `ctx.page.waitForSelector(...)`
- `ctx.page.waitForLoadState(...)`
- `ctx.page.evaluate(...)`
- `ctx.page.type(...)`
- coordinate-based `ctx.page.click(x, y)`
- coordinate-based `ctx.page.hover(x, y)`

### Avoid assuming these are available

- `locator.waitFor()`
- `locator.isVisible()`
- `getByRole()`
- Playwright-first locator chains
- `page.click(selector, options)` style assumptions
- `page.hover(selector, options)` style assumptions

If unsure, inspect existing samples first and follow the patterns that already work in this repo.

## Sample authoring principles

### 1. Test bodies should say **what is being verified**

Keep the scenario/test file focused on intent.

Examples:

- which user-visible behavior is under test
- which state transition matters
- what counts as success or failure

### 2. Helpers should explain **why the implementation looks unusual**

Move UI-specific mechanics into helper files, especially when they involve:

- noisy hosted docs pages
- coordinate interaction
- animation timing
- visual observation logic
- workarounds for Stagehand/runtime behavior

But do not hide the purpose of the test inside helpers.

### 2.5. Grow helpers in this order: group → case → framework

When a helper pattern seems reusable, do **not** rush it straight into the framework.

Preferred incubation order:

1. **test group**
   - first let it live inside a focused group such as `examples/shadcn-component`
   - confirm the pattern is genuinely recurring
2. **test case family**
   - then reuse it across multiple cases in that same group
   - refine naming and scope based on actual usage
3. **framework**
   - only after it proves stable and broadly useful should it move into shared framework APIs

Why this matters:

- premature abstraction creates weak framework APIs
- local duplication is often acceptable while patterns are still being discovered
- samples in this repo are also executable design probes for future framework improvements

In short: **brew helpers locally first, then promote them upward when the pattern is real**.

### 3. Samples are documentation

For this repo, examples are expected to be readable by humans trying to learn how to author tests.

That means comments are often desirable when they explain:

- why a target element is selected that way
- why a fixed wait exists as an exception
- why visible state is judged by perception rather than raw DOM existence
- why VRT utilities are separated from interaction helpers

### 4. Human-perceivable behavior matters

Prefer assertions that reflect what a user can actually observe.

Examples:

- centered item changed
- a tooltip visibly appeared
- a button became visually disabled
- a partial screenshot changed enough to be meaningful

A passing test that only proves a weak internal detail is often not good enough here.

## Hosted docs / demo pages: expected complications

Many samples in this repo target public hosted docs pages.
Those pages can be noisy and flaky in ways local apps are not.

Expect to handle:

- multiple demos on one page
- hydration timing
- animations
- portals
- delayed visible state transitions
- page structures that are optimized for docs, not test ergonomics

### Guidance

- first decide **which demo instance** is the test target
- prefer DOM observation before choosing an interaction strategy
- use `evaluate()` heavily when needed
- use coordinate interactions for tricky widgets
- use fixed waits only as an explicit exception, and explain why in comments

## Visual regression testing in this repo

VRT here is usually lightweight and local to a sample.
It is not assumed that every sample needs a large shared VRT framework.

Typical acceptable pattern:

- capture a partial screenshot around the relevant UI
- save a baseline
- compare with `pixelmatch`
- assert on mismatch ratio
- store a diff image for inspection

### Important

- size mismatch should fail immediately, not be treated as a successful comparison
- screenshot/diff directories should be created by helpers when needed
- use stable clip regions when hidden/visible state changes alter bounding boxes

## Dependency guidance

Because this is an E2E test authoring library repo, dependency decisions should be judged in repo context.

Do **not** mechanically apply generic app-repo advice like:

- “move this to devDependencies because it is only used in tests”
- “remove comments because production code should be concise”
- “eliminate helper files because the code is short”

Instead ask:

- Does this make the sample easier to run?
- Does this make the sample easier to learn from?
- Does this help executable documentation stay self-contained?
- Does this match how the repo actually teaches usage?

## Review guidance

AI review comments may misunderstand this repo's constraints.
That is normal.

Before applying a review suggestion, verify it against:

1. Stagehand runtime reality
2. sample readability
3. hosted demo behavior
4. repo purpose as a testing library

If a suggestion is not adopted:

- do not silently ignore it
- reply in the review thread
- explain why it is not being applied in this repo context

## Preferred outcome

The best contribution to this repo is usually not the shortest code.
It is the code that most clearly demonstrates:

- how to author tests with Voreux
- how to think when a UI is tricky
- how to verify real user-visible behavior
- how to work within Stagehand constraints
