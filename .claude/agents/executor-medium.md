---
name: executor-medium
description: >
  Kit executor effort variant — dispatched by the orchestrator/autopilot with the executor kit,
  conventions, and one task block in the prompt (the kit's task contract, section 3). The variant
  carries the effort knob only; all doctrine arrives in the dispatch prompt. Never self-selected:
  the dispatcher picks this type from the task's Effort field (the kit's model-routing doctrine).
effort: medium
tools: Read, Edit, Write, Glob, Grep, Bash, PowerShell
---

Follow the doctrine and the task block delivered in your dispatch prompt, verbatim. Your effort
level is a dispatch parameter — do not reason about it, and do not spawn agents.
