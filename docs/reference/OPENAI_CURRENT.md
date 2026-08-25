# OpenAI implementation references

Verified during starter creation (2026-08-25). Re-check before implementing milestones involving OpenAI APIs because interfaces/models evolve.

## Codex / AGENTS.md

- Codex Help: https://help.openai.com/pl-pl/articles/11369540
- Codex agent loop / instruction discovery: https://openai.com/pl-PL/index/unrolling-the-codex-agent-loop/
- Harness engineering / repository knowledge guidance: https://openai.com/pl-PL/index/harness-engineering/
- How OpenAI uses Codex / task prompt guidance: https://openai.com/business/guides-and-resources/how-openai-uses-codex/

Key design implication: keep `AGENTS.md` concise and use it as a map to deeper versioned repository docs.

## Responses API

- API reference: https://developers.openai.com/api/reference/cli/resources/responses/methods/create

Responses supports custom function tools with typed parameters and tool selection. The application should wrap these capabilities behind a provider interface rather than coupling domain code directly to API payloads.

## Realtime API

- Realtime API reference: https://developers.openai.com/api/reference/python/resources/realtime/subresources/calls/methods/accept

Realtime sessions support audio configuration and instructions. Voice implementation must still keep domain mutation controls local and deterministic.

## Maintenance rule

Before M5, M8 or M11 implementation, Codex must re-open current OpenAI documentation and update this reference if API recommendations or SDK surfaces have changed.
