# Schemas

JSON Schema files are normative design artifacts for M4. The implementation should generate/maintain equivalent Zod schemas and add a consistency test or generation strategy to avoid schema drift.

`schemas/tools/tool-manifest.json` is the expected high-level capability inventory; individual tool schemas may be added incrementally as milestones implement them.

M4 pairs every individual schema with a strict Zod runtime counterpart. Tool inputs live
under `schemas/tools`; active read/analysis output contracts live under
`schemas/tool-outputs`, with shared definitions in
`read-tool-output-definitions.json`. Presence in `tool-manifest.json` alone does not make
a capability executable.
