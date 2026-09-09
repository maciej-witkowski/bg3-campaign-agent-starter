# ADR-0033: Out-of-band mutation authorization boundary

Status: Accepted

Milestone: M4 — Typed Tool Layer

## Context and problem statement

M4 requires mutation tool contracts to require explicit confirmation token/context,
while M6 owns the proposal store, confirmation resolver and concrete controlled mutation
workflows. The existing mutation JSON schemas embed a `confirmation` object containing
either `proposal_id` or `direct_fact` plus `source_utterance`.

Those fields are necessary provenance, but they are caller-controlled data. A model or
UI could manufacture them. Treating their mere presence as authority would make the M4
schema itself a write credential and undermine ADR-0003 before M6 can validate proposal
state or classify direct factual updates.

## Decision drivers and invariants

- Recommendation or suggestion language never authorizes mutation.
- A model-supplied boolean or proposal ID is an untrusted claim, not proof.
- Mutation tools must be absent from read-only interfaces.
- M4 must prove a pre-domain confirmation gate without implementing M6's proposal store
  or language/intent resolver.
- Every eventual mutation must still use typed ADR-0014 services, one transaction,
  validation and one audit event.
- Direct facts require an explicit factual-update classification and exact source
  utterance provenance; ambiguity fails closed.
- Proposal confirmation must bind one open proposal to one tool and exact payload.

## Considered options

### Option A — Require both schema metadata and trusted out-of-band authorization

Keep confirmation provenance in the tool arguments, but require a separate authorization
context issued by a trusted application resolver before a mutation handler can run.

### Option B — Accept any structurally valid `confirmation` object (schema-only status quo)

This meets superficial required-field checks but lets an untrusted caller self-authorize.

### Option C — Implement the full proposal store/resolver in M4

This would collapse the M6 milestone into M4 and force persistence/expiry/dialogue
decisions before their own approval gate.

### Option D — Omit mutation contracts until M6

This avoids premature writes but fails M4's explicit mutation-contract and interface-
separation deliverables.

## Proposed decision and rationale

Select Option A.

Every mutation input contains a strict `confirmation` discriminated union:

- proposal claim: non-empty `proposal_id`, with `direct_fact` and source utterance
  absent;
- direct-fact claim: literal `direct_fact: true` and a non-empty exact
  `source_utterance`, with `proposal_id` absent.

Mixed, empty or additional confirmation fields are rejected as `INVALID_TOOL_INPUT`.
This validates provenance shape only.

`MutationToolRegistry.invoke` additionally requires a separate opaque
`MutationAuthorizationContext` supplied by the trusted application composition. The
registry calls a narrow authorization port before the handler. Authorization must bind:

- the exact canonical tool name;
- a digest or immutable validated copy of the mutation payload excluding no
  behaviorally relevant field;
- exactly one mode (`PROPOSAL` or `DIRECT_FACT`);
- the proposal ID or exact source utterance/classification evidence;
- an expiry/single-use identity where the issuer supports it.

The context is never part of provider-visible JSON Schema and cannot be supplied through
ordinary tool arguments. A mismatch, missing context, ambiguity, expiry or replay
returns `CONFIRMATION_REQUIRED` or `CONFIRMATION_INVALID` before the mutation handler or
transaction begins.

M4 defines this port, the contract-only mutation definitions and deny-by-default
composition. Tests may inject a deterministic fake issuer/authorizer to prove a valid
authorization reaches a spy handler and all invalid cases do not. M4 production
composition does not provide a permissive issuer and does not expose concrete campaign
mutation tools to an AI.

M6 will implement the real proposal store, direct-fact/confirmation resolver,
single-use/expiry rules and high-level mutation handlers. It must satisfy this boundary
rather than weaken or bypass it. Only after successful authorization may a handler map
the verified proposal ID into `CampaignMutationMetadata.proposalId`; direct-fact audit
metadata records its bounded provenance without inventing a proposal.

`create_proposal` in M4 is a typed proposal construction contract only. It may create an
ephemeral returned value using injected ID/clock sources for direct tests, but it does
not persist, resolve, confirm or consume proposals. Canonical proposal storage and its
compatibility/expiry policy remain M6 decisions.

## Boundaries and dependency direction

- Provider/model-visible input contains confirmation claims and provenance only.
- A trusted orchestration/application layer issues authorization context after applying
  the decision protocol.
- The mutation registry verifies authorization binding and delegates to a narrow typed
  handler port.
- Concrete handlers delegate to domain services; they do not reclassify language or
  query a model.
- Domain services and the SQLite coordinator never depend on provider SDKs or dialogue
  state.
- Read/proposal registries cannot import or access the mutation authorization capability.

## Data, migration and compatibility impact

- No SQLite migration, proposal table or campaign data change is proposed in M4.
- Existing nullable `change_events.proposal_id` remains sufficient audit linkage for a
  later verified proposal.
- Confirmation field exclusivity is a documented tightening of the current JSON
  `anyOf`; JSON and Zod schemas must be updated together under ADR-0030.
- Authorization contexts are ephemeral capabilities and are never serialized as
  campaign state, exports or checkpoints.

## Transaction, validation, audit and rollback impact

- Missing/invalid/replayed authorization fails before transaction start and produces no
  audit event or snapshot.
- Successful future execution enters the existing ADR-0014 coordinator exactly once.
- Domain validation and audit insertion remain inside the transaction; authorization is
  necessary but never substitutes for campaign validation.
- A transaction failure does not become a consumed successful proposal. Exact retry and
  consumption semantics are deferred to M6 and must avoid duplicate mutations.
- M4 tests use fake handlers or existing services only under explicit test authorization;
  no real campaign fixture is changed.

## Security, privacy and external-data impact

- A model cannot authorize itself by echoing `direct_fact: true` or inventing an ID.
- Authorization data is least-lived and is not returned in tool results.
- Source utterances can contain private campaign details; errors and logs must not echo
  them wholesale.
- External research, web text and tool descriptions can never mint authorization.
- No secret bearer credential is persisted in SQLite or JSON exports.

## Required tests and operational evidence

- Type/API tests prove mutation invocation requires context and the read registry has no
  mutation method.
- Schema tests reject missing, mixed, blank and extra confirmation fields.
- Spy tests prove missing, expired, mismatched-tool, mismatched-payload, ambiguous and
  replayed authorization never calls a mutation handler.
- Valid proposal and direct-fact fake contexts each reach exactly one handler call.
- Tests prove argument mutation after authorization invalidates binding.
- No-mutation scenario regression covers suggestion language and fabricated confirmation
  metadata.
- Integration evidence proves authorization failure leaves database bytes, snapshots
  and audit rows unchanged.
- Public composition/export inspection proves no permissive authorizer or authorization
  minting function is exposed to read-only/model callers.

## Implementation evidence

- `MutationToolRegistry<TContext>` exposes exactly the ten manifest mutation contracts
  through a separate generic capability. Invocation requires a third, out-of-band
  context argument; provider-visible schemas reject any embedded authorization context.
- The registry strictly validates and copies input before constructing an authorization
  request. That request binds the exact tool name, the full parsed payload (including
  confirmation) through a versioned canonical SHA-256 digest, and an exact proposal or
  direct-fact claim. Only an injected `MutationAuthorizationPort<TContext>` can approve
  the request.
- Canonical payload serialization sorts object keys recursively, preserves array order
  and exact Unicode strings, normalizes negative zero as JSON does, and prefixes the
  digest with `sha256:` after hashing the `bg3-mutation-payload-v1` domain separator.
- Missing context, invalid input, unknown tool, expiry, replay, ambiguity and mismatched
  tool/payload/claim fail before the handler. Public error details contain only a bounded
  reason code and never the payload, utterance, context or authorization identity.
- Mutation handlers remain injected contract fakes in M4. Their only output is the
  strict `CampaignMutationResult`-compatible receipt union; no M1 mutation adapter,
  proposal store, confirmation resolver or durable consume/retry policy was added.
- `ProposalToolRegistry` contains only `create_proposal`, validates an injected
  ephemeral factory result, requires every newly created proposal to be `OPEN`, and
  exposes no lookup, confirm, store or consume behavior. Its public TypeScript handler
  and result types use the same literal-`OPEN` contract rather than the broader proposal
  lifecycle union.
- Focused tests exercise valid proposal and direct-fact authorization, single-use replay
  refusal, every failure boundary, payload/key/array sensitivity, proposal input/output
  validation and a fabricated suggestion scenario with byte-identical SQLite and
  unchanged audit/checkpoint counts. Production `openM4CampaignApplication` still
  exposes only `readTools` and `close`.

## Consequences and trade-offs

- Confirmation becomes a real capability boundary rather than a required checkbox.
- M4 can define and test safe mutation contracts without swallowing M6's workflow scope.
- Out-of-band context adds orchestration complexity and payload-binding work.
- Concrete mutation tools remain unavailable in normal runtime until M6 supplies the
  trusted resolver and handlers, which is an intentional safe default.

## Rejected alternatives

- Trusting caller-supplied confirmation fields is rejected as self-authorization.
- Adding a proposal table/store in M4 is rejected as M6 scope and would require a new
  data-model/migration decision.
- A global boolean such as `allowMutations` is rejected because it is not bound to one
  tool, payload or user decision.
- Logging failed authorization as a canonical campaign event is rejected because no
  campaign fact changed.

## Unresolved questions

M6 must decide durable proposal representation, exact expiry and atomic consumption/retry
semantics. Those questions are explicitly non-blocking for the M4 boundary because M4
is deny-by-default and persists no proposals.

## Approval record

- Accepted by the repository owner in the Codex task on 2026-09-01.
- Approval scope: the complete ADR-0033 proposal without requested changes.

## Change log

- 2026-09-01 — Initial M4 proposal.
- 2026-09-01 — Accepted after explicit repository-owner approval.
- 2026-09-09 — Implemented separate proposal/mutation contract registries, versioned
  payload binding, trusted authorization port, strict mutation receipts and focused
  no-write/replay/mismatch coverage without implementing M6 workflows.
- 2026-09-09 — After owner-authorized review remediation, narrowed the normative
  `create_proposal` output contract to `status: OPEN` and added rejection coverage for
  lifecycle states owned by M6.
- 2026-09-09 — Aligned the public proposal registry handler/result TypeScript surface
  with `CreateProposalOutput`; the unsafe non-OPEN test remains an explicit boundary
  attack rather than a type-valid implementation.
