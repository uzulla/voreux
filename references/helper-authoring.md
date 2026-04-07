# Helper authoring notes

This file exists because helpers in this repo are often authored by agents.
Do not rely on generic docs memory alone when creating or changing helpers.

## Interaction helper rule

If you add or change an interaction helper, passing the test is not enough.
The interaction should also be inspectable by a human in screenshots/recordings.

This applies to helpers around actions such as:
- click
- hover
- key input
- drag
- open / close
- menu / popover / dialog transitions
- future interaction-style helpers

## Recording / screenshot expectation

For interaction helpers, the required outcome is:
- a human must be able to inspect the interaction from screenshots/recordings
- the recording should not only show the final state, but also make the action progression understandable

The default recommended pattern is:
1. pre-action boundary/frame
2. action-visible frame (annotation / marker / visible transition)
3. post-action-applied frame

This three-step pattern is the first choice, but it is not a blanket MUST for every helper.
Some interactions may need a lighter shape as long as the resulting recording still makes the interaction understandable to a human.

Examples where strict three-step handling may be excessive:
- passive settle/wait helpers
- low-value internal transitions that do not benefit from extra visible markers

If the helper is paired with VRT, the timing should still make the same progression inspectable in the recording.

## Why this matters

This repo is not only verifying correctness.
It is also teaching scenario authors and helping humans review what happened.
If the video cannot show what action happened and what changed after it, the helper is incomplete even if the assertion passes.

## Escalation rule

Only general interaction primitives go upward.
Do not push sample-specific DOM lookup into framework helpers.

Promote in this order:
1. group/sample helper
2. case pattern reused in multiple places
3. framework helper

## Good candidates for framework promotion

Examples:
- generic action annotations
- hover annotation / hover recording boundary helpers
- generic recording boundary utilities around actions

## Not framework candidates

Examples:
- component-specific DOM search
- page-specific selectors
- sample-specific heuristics for one docs page
