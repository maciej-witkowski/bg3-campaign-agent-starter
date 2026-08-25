# Prompting and Codex Development Workflow

## Codex tasks
Write tasks like GitHub issues: scope, files/components, acceptance criteria and explicit non-goals.

## Persistent instructions
Keep `AGENTS.md` concise. Put deep detail in linked docs and ADRs.

## Milestone discipline
Each Codex prompt should:
- name one milestone;
- list required reading;
- state implementation requirements;
- state explicit exclusions;
- require tests and docs;
- require a final report;
- prohibit automatically starting the next milestone.

## Runtime agent prompt
The runtime campaign agent must be shorter than the repository specification and rely on typed tools for truth. Do not dump the full campaign DB into the system prompt.
