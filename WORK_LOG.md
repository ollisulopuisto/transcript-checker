# PR 3 follow-up

The bounded cue scan assumed sorted, non-overlapping input. Saved and edited
transcripts do not promise either property. The unsafe shortcut is removed;
first-match source order and half-open intervals are preserved. Two regressions
failed before the fix and pass afterward. All four Node tests pass. No browser
audio playback was run. This PR now adds correctness coverage, not a speedup.
