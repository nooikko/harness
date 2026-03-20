# Research: Claude Code OAuth Token Controversy — Third-Party Tools Ban

Date: 2026-03-20

## Summary

Anthropic enforced a ban on using Claude subscription OAuth tokens (Free, Pro, Max) in third-party tools and harnesses. The technical block was silently deployed in January 2026; the formal policy documentation followed in February 2026. The controversy is ongoing and has materially fractured the Claude developer community. Critically for Harness: Anthropic's own clarification explicitly states personal/local development with the Agent SDK and Max subscriptions remains permitted — the ban targets distributing tools that route user credentials through third-party products.

## Prior Research

- `AI_RESEARCH/2026-03-13-claude-agent-sdk-session-isolation.md` — covers SDK session mechanics but not auth policy
- `AI_RESEARCH/2026-02-22-claude-code-ecosystem-state.md` — general ecosystem state, predates the ban

## Current Findings

### 1. What Happened

The controversy is from **January–February 2026**, not February 2025 as initially believed. Timeline:

- **January 9, 2026**: Anthropic silently deployed server-side checks that broke all third-party tools using Claude Pro/Max subscription OAuth tokens. Tools like OpenCode (56,000+ GitHub stars), OpenClaw, Cline, Roo Code, and various custom harnesses stopped working overnight with 403 errors, with zero warning or migration path.
- **February 17–19, 2026**: Anthropic published updated Consumer Terms of Service and Claude Code legal documentation formally banning subscription OAuth use in third-party tools.
- **February 20, 2026**: The Register published coverage confirming Anthropic's policy. DHH publicly called it "very customer hostile."

### 2. Why Anthropic Did It

**Economic arbitrage**: A $200/month Max subscription provides unlimited tokens through Claude Code, while the same token consumption via API would cost $1,000–$5,000+. Third-party tools — especially those running autonomous "Ralph Wiggum" style self-healing loops overnight — removed the artificial usage constraints Anthropic applies within Claude Code.

**Telemetry and support**: Thariq Shihipar (Claude Code team at Anthropic) stated third-party harnesses create "unusual traffic patterns" and lack the telemetry Anthropic's official tools provide, making it difficult to help users with rate limit issues or account problems.

**Enforcement posture**: Anthropic reserved the right to enforce "without prior notice." Several legitimate developers reported account bans after Anthropic's automated systems flagged unusual traffic — including one developer banned for creating a personal usage tracker Mac app.

### 3. The Official Policy (as of February 2026)

Direct quote from `https://code.claude.com/docs/en/legal-and-compliance`:

> "OAuth authentication (used with Free, Pro, and Max plans) is intended exclusively for Claude Code and Claude.ai. Using OAuth tokens obtained through Claude Free, Pro, or Max accounts in any other product, tool, or service — including the Agent SDK — is not permitted and constitutes a violation of the Consumer Terms of Service."

> "Developers building products or services that interact with Claude's capabilities, including those using the Agent SDK, should use API key authentication through Claude Console or a supported cloud provider. Anthropic does not permit third-party developers to offer Claude.ai login or to route requests through Free, Pro, or Max plan credentials on behalf of their users."

**Notably**, the policy explicitly names the Agent SDK (Anthropic's own tool) as off-limits for consumer OAuth tokens.

### 4. The Thariq Clarification — Critical Nuance for Harness

Shortly after the February documentation update, Thariq Shihipar (Anthropic, Claude Code team) posted on X:

> "Apologies, this was a docs clean up we rolled out that's caused some confusion. Nothing is changing about how you can use the Agent SDK and MAX subscriptions!"
> — https://x.com/trq212/status/2024212378402095389

And further:

> "We want to encourage local development and experimentation with the Agent SDK and claude -p."

> "Anthropic will not be canceling accounts" for past usage.

**The clarification distinguishes:**
- **Personal/local development and experimentation** with the Agent SDK and Max subscription: **permitted**
- **Building a business or distributing a product** that routes users' credentials through subscription OAuth: **prohibited**, must use API keys

### 5. What Is Permitted vs. Prohibited

| Use Case | Status | Notes |
|---|---|---|
| Claude Code CLI (official) | Permitted | Intended use |
| Claude.ai web interface | Permitted | Intended use |
| Claude Desktop | Permitted | Official client |
| Claude API via API keys | Permitted | Pay-per-token, no restrictions |
| Bedrock / Vertex / Foundry | Permitted | Enterprise paths |
| Personal self-hosted project using your own OAuth token | **Ambiguous but likely permitted** | Thariq's clarification suggests local experimentation is fine; policy text does not carve out explicit exception |
| Harness (self-hosted, personal use, your own Max token) | **Likely permitted per Thariq** | Not distributing to others; purely personal orchestration layer |
| OpenCode, OpenClaw (distributed tools offering "Login with Claude") | **Prohibited** | Technical block + formal ban |
| Building a SaaS that uses customers' Claude OAuth tokens | **Prohibited** | Explicitly banned |
| Agent SDK with subscription OAuth in a commercial product | **Prohibited** | Named explicitly in policy |

### 6. Community Response

- **DHH**: "very customer hostile"
- **OpenCode**: Removed all Claude OAuth code the day of the formal ban, citing "Anthropic legal requests." OpenAI officially partnered with OpenCode the same day, explicitly permitting Codex subscription use in third-party tools.
- **Mass cancellations**: Multiple developers canceled $200/month Max subscriptions, citing the policy.
- **Enforcement inconsistency**: Legitimate personal users reported account bans despite Thariq's reassurances. Enforcement appears to be automated pattern-matching that catches innocent users.

### 7. The `setup-token` / `ANTHROPIC_AUTH_TOKEN` Path

The official Claude Code authentication docs describe `ANTHROPIC_AUTH_TOKEN` as an env var that "Sent as the `Authorization: Bearer` header" and is intended for "routing through an LLM gateway or proxy that authenticates with bearer tokens rather than Anthropic API keys."

The Harness project uses the Agent SDK (`@anthropic-ai/claude-agent-sdk`) via programmatic invocation. This is the exact pattern the February policy named as prohibited when using consumer OAuth tokens. However, Thariq's clarification that "nothing is changing about how you can use the Agent SDK and MAX subscriptions" and encouragement of "local development and experimentation" suggests personal self-hosted orchestration is treated differently from distributing a commercial product.

### 8. Recommendation for Harness

**Current risk level: LOW for personal use, but legally ambiguous.**

The Harness project is:
- Self-hosted on personal infrastructure
- Not distributed to others
- Not offering "Login with Claude" to external users
- Using your own Max subscription credentials in your own tool

This matches the description of "local development and experimentation" that Thariq explicitly said Anthropic wants to encourage and will not enforce against. The technical block also only appears to target the Claude.ai OAuth flow — using `ANTHROPIC_API_KEY` (API key from Claude Console) instead of the subscription OAuth token is the fully compliant path with zero ambiguity.

**The compliant path forward**: Use `ANTHROPIC_API_KEY` from Claude Console (pay-per-token API) rather than subscription OAuth. This eliminates all ambiguity and is what Anthropic explicitly recommends for Agent SDK usage. The cost difference is real but the legal clarity is absolute.

## Key Takeaways

- The controversy is January–February 2026, not 2025
- The formal policy bans subscription OAuth tokens everywhere except Claude Code CLI and Claude.ai
- Thariq's clarification creates a real but informal exception for personal/local experimentation
- No explicit written carve-out for personal self-hosted use exists in the official policy documents
- Harness in its current form (personal, self-hosted, not distributed) is likely in the "tolerated" zone per Thariq's statements, but not explicitly protected by the written policy
- Using an API key instead of subscription OAuth is the only path with zero ambiguity
- Enforcement has been inconsistent — automated systems have banned legitimate personal users

## Sources

- [Claude Code Legal and Compliance (official docs)](https://code.claude.com/docs/en/legal-and-compliance) — the authoritative policy text
- [Claude Code Authentication (official docs)](https://code.claude.com/docs/en/authentication) — credential precedence and ANTHROPIC_AUTH_TOKEN details
- [Thariq Shihipar on X (clarification)](https://x.com/trq212/status/2024212378402095389) — "Nothing is changing about how you can use the Agent SDK and MAX subscriptions"
- [The Register — Anthropic clarifies ban (Feb 20, 2026)](https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access/)
- [VentureBeat — Anthropic cracks down on unauthorized Claude usage](https://venturebeat.com/technology/anthropic-cracks-down-on-unauthorized-claude-usage-by-third-party-harnesses)
- [Natural20 — Anthropic Banned OpenClaw](https://natural20.com/coverage/anthropic-banned-openclaw-oauth-claude-code-third-party)
- [Hacker News — Anthropic officially bans subscription auth](https://news.ycombinator.com/item?id=47069299)
- [Piunika Web — Contradiction between ban and Thariq's clarification](https://piunikaweb.com/2026/02/19/anthropic-claude-max-ban-agent-sdk-clarification/)
- [Rob Zolkos on X — policy quote](https://x.com/robzolkos/status/2024125323755884919)
- [opencode GitHub issue #6930 — Using opencode with OAuth violates ToS](https://github.com/anomalyco/opencode/issues/6930)
- [Engineers Codex — Anthropic's Confusing Subscription Policy](https://www.engineerscodex.com/anthropic-claude-subscription-switcharoo)
