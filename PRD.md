# Consilium PRD

Status: Draft MVP
Owner: Product / Founding Team
Last updated: 2026-03-10

## 1. Overview

Consilium is a multi-persona advisory web app that lets a user assemble a private council of 3 to 5 advisors and ask that council for guidance on decisions, strategy, writing, problem-solving, and reflection.

Each advisor responds from a distinct worldview. The product value is not generic multi-agent output. The value is useful contrast, visible disagreement, and a final synthesis that helps the user act.

The product should feel like a serious decision tool, not a novelty chatbot.

Working tagline:
"Your private council of minds."

## 2. Problem

Most AI chat products return a single answer, which makes it hard to:

- compare competing viewpoints
- expose blind spots
- pressure-test decisions
- separate consensus from disagreement

Users often simulate this manually by prompting the model to "answer as" multiple people. That workflow is brittle, low-trust, repetitive, and hard to reuse across sessions.

## 3. Product Vision

Build a persistent advisory council where each persona is created from a structured profile backed by evidence, then used repeatedly in chat. For every user query:

- all selected personas receive the same request
- each persona answers in a short structured format
- each persona can answer directly, make a cautious inference, or abstain
- the system produces a synthesis showing agreement, disagreement, and a recommended next step

## 4. Target Users

Primary users:

- founders and operators making business decisions
- creators and writers seeking critique from multiple lenses
- professionals working through career or life tradeoffs
- intellectually curious users who want structured perspective, not one-shot advice

Secondary users:

- coaches, consultants, and solo decision-makers
- students and researchers comparing schools of thought

## 5. Core Product Principles

1. Contrast over volume
Responses must be meaningfully different, not five paraphrases.

2. Structured over chatty
Short, scannable responses beat long essays.

3. Evidence over imitation
Personas should be grounded in sources and explicit uncertainty, not shallow roleplay.

4. Trust through restraint
The system should say "no basis" when it lacks enough evidence.

5. Synthesis is part of the product
The final summary is a first-class feature, not an optional extra.

## 6. MVP Scope

The MVP supports:

- user authentication
- onboarding that requires creating a council of at least 3 personas
- up to 5 personas per council
- persona creation from a real person name or user-defined custom advisor
- assisted research and persona profile generation
- human review before saving a persona
- a council chat interface
- parallel persona responses
- synthesis after each turn
- saved conversation history

The MVP does not support:

- voice conversations
- persona-to-persona debate rounds
- tool use inside persona responses
- exact mimicry of living people
- unrestricted auto-generated personas without review
- enterprise collaboration

## 7. User Experience

### 7.1 First-Time User Flow

1. User lands on the app and signs up.
2. User is told they need to create their council.
3. User creates at least 3 personas and may create up to 5.
4. For each persona:
   - user enters a name or creates a custom advisor
   - system researches and drafts a profile
   - user reviews the profile, core themes, and confidence
   - user edits if needed
   - persona is saved
5. Once the minimum council size is reached, user enters the main chat experience.

### 7.2 Main Chat Experience

For each prompt:

- all active personas receive the same input
- each persona returns a structured card
- the product displays a synthesis below the cards

Persona card fields:

- name
- response type: `Answer`, `Inference`, or `No basis`
- verdict
- key reasoning
- recommended action
- confidence badge

Synthesis fields:

- where the council agrees
- where the council disagrees
- most actionable next step
- optional combined recommendation

## 8. Persona Creation

### 8.1 Persona Types

The system should support two persona types:

- real-person-inspired persona
- custom advisor persona authored by the user

For real people, the system must frame the output as:
"A perspective modeled from public materials and recurring themes."

It must not claim literal simulation or certainty.

### 8.2 Persona Creation Pipeline

When a user enters a person name:

1. Name intake
2. Entity resolution
3. Source discovery
4. Source ranking and filtering
5. Theme extraction
6. Persona profile generation
7. Confidence scoring
8. User review and edit
9. Save persona

### 8.3 Research Requirements

The system should gather enough material to build a useful persona profile, including when available:

- biography and background
- major works
- interviews and talks
- books, essays, speeches, or teachings
- recurring ideas and doctrine
- notable contradictions or tensions
- signature phrases or communication style
- domain expertise areas

The system should prioritize:

- official websites
- books and primary writings
- verified interviews and talks
- reputable biographies or references

The system should avoid over-relying on:

- fan pages
- low-quality quote sites
- unsourced summaries
- gossip or purely speculative commentary

### 8.4 Persona Profile Structure

Each saved persona should contain structured fields, not just a single prompt blob.

Example schema:

```json
{
  "id": "persona_123",
  "display_name": "Naval Ravikant",
  "persona_type": "real_person",
  "identity_summary": "Investor and writer focused on leverage, wealth creation, and specific knowledge.",
  "worldview": [
    "optimize for leverage",
    "play long-term games",
    "build specific knowledge"
  ],
  "communication_style": [
    "concise",
    "reflective",
    "high-level"
  ],
  "decision_style": [
    "first-principles",
    "asymmetric upside",
    "anti-status games"
  ],
  "values": [
    "freedom",
    "clarity",
    "independence"
  ],
  "blind_spots": [
    "may underweight institutional constraints"
  ],
  "domain_confidence": {
    "startups": 0.95,
    "wealth": 0.97,
    "politics": 0.41
  },
  "source_count": 34,
  "source_quality_score": 0.88
}
```

### 8.5 Runtime Persona Layers

At runtime, each persona should use three layers:

1. Core identity card
Structured persona profile and decision rules.

2. Evidence pack
Retrieved supporting materials relevant to the current question.

3. Runtime behavior rules
Instructions for how to answer, when to infer, and when to abstain.

This is preferable to a single oversized system prompt.

## 9. Response Modes

Each persona must return one of three states:

- `Answer`: the persona has strong enough basis to answer directly
- `Inference`: the persona is extrapolating from adjacent beliefs and should say so
- `No basis`: the persona lacks enough evidence to respond faithfully

This behavior is mandatory for MVP because it improves trust and avoids fake confidence.

## 10. Functional Requirements

### 10.1 Authentication

- Users can sign up, log in, and log out.
- Each user has one default council in MVP.

### 10.2 Persona Management

- Users can create 3 to 5 personas.
- Users can edit persona profiles after creation.
- Users can deactivate a persona without deleting it.
- Users can replace a persona, but the council must still have at least 3 active personas.

### 10.3 Research and Drafting

- System accepts a person name and begins persona research.
- System resolves ambiguous names when possible.
- System drafts a persona profile and shows a preview.
- User must confirm or edit before the persona is saved.
- Persona creation should surface confidence and source quality.

### 10.4 Chat

- Users submit a prompt to the council.
- The same prompt is routed to all active personas.
- Persona responses are generated in parallel.
- The app renders each persona result as a card.
- The app renders a synthesis after persona responses complete.

### 10.5 Persistence

- Persona definitions are stored for reuse.
- Conversation threads are stored per user.
- The system stores enough metadata to audit how a persona was created.

## 11. Non-Functional Requirements

### 11.1 Performance

- Persona card streaming should start quickly after query submission.
- Full council response for 3 personas should feel near-real-time.
- Synthesis should appear immediately after the final persona result.

MVP target:

- first response token under 3 seconds in common cases
- full response under 12 seconds in common cases

### 11.2 Reliability

- Persona creation jobs should be resumable.
- Failed persona creation should surface a useful retry state.
- Partial chat failures should not break the whole turn. If one persona fails, the others should still render.

### 11.3 Transparency

- Users should see whether a response is an answer, inference, or no basis.
- Users should be able to inspect a persona summary and source confidence.

## 12. Safety and Policy Constraints

This product should avoid presenting itself as exact replication of real people.

Rules:

- do not claim literal identity or consciousness
- do not state fabricated certainty about a person’s beliefs
- do not answer outside evidence with false confidence
- clearly label inferred responses
- support abstention when evidence is weak

If legal or policy constraints require stricter handling for public figures or living individuals, the MVP should degrade gracefully by:

- limiting generated style mimicry
- using paraphrased worldview modeling instead of impersonation
- restricting unsupported domains

## 13. Recommended Technical Architecture

### 13.1 Stack

- Frontend: Next.js + TypeScript
- Backend API: FastAPI
- Orchestration: LangGraph
- Database: Postgres
- Vector search: pgvector or a dedicated vector store
- Auth: Clerk, Supabase Auth, or Auth.js
- LLM provider: Gemini for MVP, provider-agnostic interface later

### 13.2 Why LangGraph

LangGraph is a fit because the product has two explicit workflows with durable state:

- persona creation graph
- council response graph

It also gives clean support for:

- parallel persona execution
- retries
- stateful steps
- inspectable orchestration
- future debate flows

## 14. LangGraph Workflows

### 14.1 Persona Creation Graph

```text
name intake
-> entity resolution
-> research planning
-> source collection
-> source ranking/filtering
-> persona extraction
-> profile builder
-> confidence scoring
-> user review
-> save persona
```

### 14.2 Council Query Graph

```text
user query
-> task classification
-> parallel dispatch to active personas
-> persona retrieval + reasoning
-> self-check for answer/inference/no basis
-> persona card outputs
-> synthesis
-> save conversation turn
```

## 15. Data Model

Core entities:

- `users`
- `councils`
- `personas`
- `persona_sources`
- `persona_snapshots`
- `conversations`
- `messages`
- `persona_responses`
- `syntheses`

Suggested table notes:

- `personas` stores the current editable persona definition
- `persona_snapshots` stores immutable versions used in past conversations
- `persona_sources` stores URLs, source type, quality score, and extraction metadata
- `persona_responses` stores response type, confidence, and structured output fields

## 16. Prompting and Output Design

Each persona response should use a strict schema.

Example:

```json
{
  "response_type": "answer",
  "verdict": "Do it, but validate demand before building fully.",
  "reasoning": "This idea is differentiated when the synthesis is strong and the persona quality is high.",
  "recommended_action": "Prototype the council chat and persona review flow before building debate mode.",
  "confidence": 0.84
}
```

The synthesizer should produce:

```json
{
  "agreements": ["The product needs strong persona differentiation."],
  "disagreements": ["Whether real-person personas should be central to the UX."],
  "next_step": "Build and test the persona creation workflow first.",
  "combined_recommendation": "Launch with evidence-backed profiles and visible abstention."
}
```

## 17. MVP Milestones

### Milestone 1: Foundation

- auth
- database schema
- council and persona models
- basic UI shell

### Milestone 2: Persona Creation

- name input flow
- research pipeline
- draft profile generation
- user review and save

### Milestone 3: Council Chat

- chat thread
- parallel persona responses
- synthesis card
- saved history

### Milestone 4: Trust and Quality

- answer/inference/no-basis logic
- source confidence surfacing
- retries and failure handling

## 18. Success Metrics

Early product metrics:

- percentage of users who complete creation of at least 3 personas
- median time to first successful council chat
- average number of follow-up prompts per session
- percentage of responses marked as helpful
- percentage of persona responses that are clearly differentiated
- abstention rate on weakly supported prompts

## 19. Risks

### 19.1 Persona Quality Risk

If personas sound too similar, the product loses its point.

Mitigation:

- structured worldview fields
- persona-specific retrieval
- strong response schema
- evaluation for differentiation

### 19.2 Trust Risk

Users may over-believe simulated real-person answers.

Mitigation:

- label modeled perspective clearly
- show inference vs no-basis states
- avoid claims of exact fidelity

### 19.3 Research Cost Risk

Persona creation can become slow and expensive.

Mitigation:

- asynchronous creation jobs
- cached source processing
- staged research depth

### 19.4 UX Overload Risk

Too much text makes the product tiring.

Mitigation:

- keep persona cards concise
- structure every output
- limit initial council size to 3 in onboarding

## 20. Open Questions

- Should the MVP allow only one council per user, or multiple named councils?
- Should custom user-authored personas launch in MVP or shortly after?
- What sources are permitted for persona creation in the first release?
- Do we support live web refresh of persona evidence after creation, or freeze a persona until manually refreshed?
- How much editing control should a user have over an auto-generated persona profile?

## 21. Final MVP Recommendation

Ship the first version as a serious, evidence-backed advisory product with:

- 3 required personas at onboarding
- up to 5 personas total
- short structured persona cards
- visible answer/inference/no-basis states
- a strong synthesis layer

Do not ship the MVP as "five celebrity bots talking at once."

The durable product is a trusted advisory council, not a novelty imitation engine.

## 22. Pricing Model and Product Tiers

### 22.1 Strategy

Consilium follows a freemium model. The free tier delivers the complete core product experience with no artificial restrictions on the advisory loop. The premium tier unlocks advanced workflow features, deeper research capabilities, and power-user tools that multiply value for heavy, serious users.

The guiding principle is: **the free tier should be good enough that users recommend it to others; the premium tier should be compelling enough that power users upgrade without hesitation.**

This model is designed to:

- maximize adoption and word-of-mouth by letting every user experience the full core product
- build trust before asking for payment
- align revenue with usage intensity, not with withholding core value
- reduce churn by ensuring free users never feel punished

### 22.2 Free Tier

The free tier includes the complete Consilium experience as described in the MVP scope.

**Council and Personas**

- create and manage one council of up to 5 advisors
- full access to both real-person-inspired personas and custom advisors
- full persona research pipeline including source discovery, theme extraction, and confidence scoring
- full persona editing after creation
- activate, deactivate, and replace advisors freely within the 5-persona cap

**Chat**

- unlimited conversations with the full council
- parallel persona responses with structured output
- full synthesis after every turn including agreements, disagreements, and recommended next step
- expandable reasoning view for each advisor response
- answer, inference, and no-basis response classifications visible on every response

**Persistence**

- full conversation history with no time-based expiry
- saved persona definitions and source metadata

**Model Access**

- standard-tier LLM for all persona responses and synthesis

### 22.3 Premium Tier

Premium is priced at a monthly subscription. Suggested launch price: $12 to $20 per month depending on early demand testing.

Premium unlocks features that go beyond the core advisory loop and serve users who use Consilium as a regular decision-making tool.

#### 22.3.1 Multiple Councils

Free users have one council. Premium users can create and maintain multiple named councils, each with its own set of advisors.

Use cases:

- separate councils for business decisions, creative work, personal life, and technical architecture
- a career council with professional mentors and a writing council with literary critics
- context-switching between domains without rebuilding the advisor panel

Each council operates independently with its own conversation history and advisor configuration.

#### 22.3.2 Advisor Debates

Premium users can trigger a structured debate between two or more advisors on a specific point of disagreement surfaced in the synthesis.

How it works:

- after a council response, the user selects a disagreement or clicks "Debate this"
- the system runs a multi-round exchange between the disagreeing advisors
- each round is structured: claim, counter-claim, concession or rebuttal
- the debate concludes with a final position summary from each advisor and an updated synthesis

This feature directly extends the core product principle of contrast over volume. It lets users pressure-test the most interesting tensions instead of accepting the first synthesis.

Debate configuration:

- user can select which advisors participate
- user can set the number of rounds (2 to 5)
- debates are saved as part of the conversation thread

#### 22.3.3 Single-Advisor Follow-Up

Premium users can break out of the council format and have a direct follow-up conversation with one specific advisor.

Use cases:

- drilling deeper into one advisor's reasoning without noise from the others
- asking an advisor to elaborate on a specific recommendation
- exploring a niche topic where only one advisor has domain confidence

The follow-up thread is linked to the original council conversation for context continuity.

#### 22.3.4 Advanced Persona Research

Premium persona creation uses deeper research and higher-quality analysis.

Enhancements over the free tier:

- expanded source discovery with more source types and broader search
- deeper theme extraction with more granular worldview modeling
- higher-fidelity communication style analysis
- periodic persona refresh: the system can re-run research to update a persona with new public material (user-triggered, not automatic)
- source-level detail view showing individual source quality scores, extraction confidence, and contribution to the persona profile

Free persona research is fully functional and produces high-quality profiles. Premium research produces richer, more nuanced profiles with more supporting evidence and finer-grained confidence data.

#### 22.3.5 Conversation Branching

Premium users can fork a conversation at any point to explore alternative lines of questioning.

How it works:

- user selects a previous turn in the conversation
- user submits an alternative prompt from that point
- the system creates a new branch with full council responses
- branches are visually navigable from the conversation view

This supports exploratory decision-making where the user wants to compare how the council responds to different framings of the same problem.

#### 22.3.6 Export and Sharing

Premium users can export and share their work.

Export formats:

- Markdown
- PDF
- structured JSON (for programmatic use or archiving)

Export scope:

- single conversation
- single council turn (all advisor responses plus synthesis)
- full conversation thread with all branches

Sharing:

- generate a read-only shareable link to a specific conversation or synthesis
- the shared view preserves the full layout including advisor names, response types, confidence, and synthesis
- shared links can be set to expire after a configurable period

#### 22.3.7 Priority Model Access

Premium users receive responses from the best available LLM tier.

This means:

- higher-quality reasoning and more nuanced persona responses
- faster response generation with priority queuing during high-traffic periods
- access to newer model versions as they become available

The free tier uses a capable but cost-optimized model. The premium tier uses the highest-quality model available in the provider stack.

#### 22.3.8 Advisor Analytics

Premium users get an analytics dashboard that surfaces patterns across their council usage over time.

Metrics and insights:

- **advisor agreement frequency**: which advisors tend to agree with each other and which consistently disagree
- **user alignment**: which advisor's recommendations the user follows up on most often (based on follow-up prompt patterns)
- **topic heatmap**: what domains and topics the user asks about most frequently
- **confidence trends**: how advisor confidence varies across topic areas over time
- **synthesis patterns**: recurring themes in agreements and disagreements across conversations

This feature turns Consilium from a session-by-session tool into a longitudinal decision-support system. Users can see their own decision patterns reflected through the lens of their advisory council.

### 22.4 Tier Comparison Summary

| Capability | Free | Premium |
|---|---|---|
| Council size | 1 council, up to 5 advisors | Multiple councils, up to 5 advisors each |
| Persona types | Real-person and custom | Real-person and custom |
| Persona research | Full pipeline | Enhanced: deeper sources, refresh, source detail |
| Persona editing | Full | Full |
| Conversations | Unlimited | Unlimited |
| Conversation history | Full, no expiry | Full, no expiry |
| Synthesis | Full (agreements, disagreements, next step) | Full |
| Reasoning view | Expandable | Expandable |
| Response classifications | Visible | Visible |
| Advisor debates | Not available | Multi-round structured debates |
| Single-advisor follow-up | Not available | Direct follow-up threads |
| Conversation branching | Not available | Fork and explore alternatives |
| Export | Not available | Markdown, PDF, JSON |
| Sharing | Not available | Read-only shareable links |
| Model quality | Standard | Priority (best available) |
| Analytics | Not available | Full advisor and usage analytics |

### 22.5 Future Tier Considerations

The following are not included in the initial launch but may be added as higher tiers or add-ons based on demand:

- **Team or Enterprise tier**: shared councils across team members, collaborative conversations, admin controls, SSO, and audit logging
- **API access**: programmatic access to the council for integration into other tools and workflows
- **Custom model selection**: let users choose which LLM provider and model backs each advisor
- **Advisor marketplace**: community-contributed persona templates that users can import, with revenue sharing for top contributors
- **Voice conversations**: real-time voice interaction with the council (significant infrastructure cost, likely a separate pricing tier)

These are noted for strategic planning only. The MVP launches with Free and Premium as described above.

### 22.6 Monetization Principles

1. Never gate the core advisory loop. The free user must experience the full ask-respond-synthesize cycle with no restrictions.
2. Premium features should feel like natural upgrades for serious users, not artificial restrictions removed.
3. Cost-intensive features (debates, enhanced research, priority models) should map to premium to maintain sustainable unit economics.
4. Pricing should be simple. One premium tier at launch. Do not over-segment until there is clear evidence of distinct user segments with different willingness to pay.
5. Consider a 7-day premium trial for new signups to let users experience the full product during onboarding, when engagement is highest.
