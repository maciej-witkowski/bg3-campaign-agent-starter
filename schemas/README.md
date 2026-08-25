# Schemas

JSON Schema files are normative design artifacts for M4. The implementation should generate/maintain equivalent Zod schemas and add a consistency test or generation strategy to avoid schema drift.

`schemas/tools/tool-manifest.json` is the expected high-level capability inventory; individual tool schemas may be added incrementally as milestones implement them.
