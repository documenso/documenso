---
description: Deep-dive interview to flesh out a spec or design document
agent: build
argument-hint: <file-path>
---

You are conducting a thorough interview to help flesh out and complete a specification or design document.

## Your Task

1. **Read the document** at `$ARGUMENTS`
2. **Analyze it deeply** - identify gaps, ambiguities, unexplored edge cases, and areas needing clarification
3. **Interview the user** by providing a question with some pre-determined options
4. **Write the completed spec** back to the file when the interview is complete

## Interview Guidelines

### Question Quality
- Ask **non-obvious, insightful questions** - avoid surface-level queries
- Focus on: technical implementation details, architectural decisions, edge cases, error handling, UX implications, security considerations, performance tradeoffs, integration points, migration strategies, rollback plans
- Each question should reveal something that would otherwise be missed
- Challenge assumptions embedded in the document
- Explore second and third-order consequences of design decisions
- Use the Web Search and other tools where required to ground questions (e.g. package recommendations)

### Question Strategy
- Start by identifying the 3-5 most critical unknowns or ambiguities
- Use the AskUserQuestion tool with well-crafted options that represent real tradeoffs
- When appropriate, offer multiple valid approaches with their pros/cons as options
- Don't ask about things that are already clearly specified
- Probe deeper when answers reveal new areas of uncertainty

### Topics to Explore (as relevant)
- **Technical**: Data models, API contracts, state management, concurrency, caching, validation
- **UX**: Error states, loading states, empty states, edge cases, accessibility, mobile considerations
- **Operations**: Deployment, monitoring, alerting, debugging, logging, feature flags
- **Security**: Auth, authz, input validation, rate limiting, audit trails
- **Scale**: Performance bottlenecks, data growth, traffic spikes, graceful degradation
- **Integration**: Dependencies, backwards compatibility, versioning, migration path
- **Failure modes**: What happens when X fails? How do we recover? What's the blast radius?

### Interview Flow
1. Ask 2-4 questions at a time (use multiple questions in one when they're related)
2. After each round, incorporate answers and identify follow-up questions
3. Continue until all critical areas are addressed
4. Signal when you believe the interview is complete, but offer to go deeper

## Output

When the interview is complete:
1. Synthesize all gathered information
2. Rewrite/expand the original document with the new details
3. Preserve the document's original structure where sensible, but reorganize if needed
4. Add new sections for areas that weren't originally covered
5. Write the completed spec back to `$ARGUMENTS`

Begin by reading the file and identifying your first set of deep questions.
