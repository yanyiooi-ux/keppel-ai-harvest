# 01 Tencent tools: what they are and how to build on them

> **Archived research (18 Sep 2026).** Written for the earlier "Pill Factory" idea. Tool facts are still useful; solution suggestions are not decisions. For how CodeBuddy reads this repo, the newer check is in `docs/decisions/2026-10-02-repo-setup-plan.md`.

Researched 18 Sep 2026. Tags like [S4] point to the source list.

## Summary

- Anchor on CodeBuddy: IDE, plugin and CLI, English docs, MCP, skills, sub-agents, plan mode, headless mode and an SDK [S1][S4][S5].
- WorkBuddy is a desktop agent app. Good for the expert interview, reusable skills and scheduled jobs. It is not hosted, so it cannot be our live demo link [S13][S14].
- ADP is a hosted agent builder: RAG, workflows, multi-agent mode, chat API and a release Approval Center. Its free plan lasts 30 days, so the claim date matters [S31][S32].
- Portability: keep every "Intelligence Pill" as plain files in Git. Tencent tools read the pills. They never own them.

## CodeBuddy

What it is. Tencent Cloud's AI coding assistant. Three surfaces share one account and credit pool: a standalone IDE (Windows, macOS), an IDE plugin, and a CLI called CodeBuddy Code, installed with `npm install -g @tencent-ai/codebuddy-code` [S1][S2][S11][S40].

Access. International site is codebuddy.ai. Sign up with Google, GitHub or email after picking a region [S11]. International and China editions have separate API keys. The CLI defaults to International [S5].

Confirmed in the English docs:
- MCP servers over STDIO, SSE and HTTP [S8].
- Skills: a folder with `SKILL.md` in `.codebuddy/skills/` [S7].
- Sub-agents: Markdown files with YAML frontmatter in `.codebuddy/agents/` [S6]. Agent Teams coordinates several CLI instances [S12].
- Plan Mode in the IDE [S10], and a read-only `plan` permission mode in the SDK [S5].
- Headless: `codebuddy -p "prompt"` with `--output-format json` or `stream-json`. Authorised actions also need `-y` [S4].
- Agent SDK: `@tencent-ai/agent-sdk` (TypeScript) and `codebuddy-agent-sdk` (Python), auth by `CODEBUDDY_API_KEY`. Marked Preview. It loads no settings, MCP servers or skills from disk by default [S5].
- Custom models: `models.json` accepts any OpenAI-compatible `/chat/completions` URL [S9].

Pricing. Free: 100 credits a month plus a promo bonus of 30 a day. Pro: USD 10 a month for 2,000 credits. Team: USD 40 per seat for 1,000. A top-up is 500 credits for USD 15 [S2]. So 1,000 credits is about half a Pro month, or USD 30 at top-up price. Burn depends on model tier, task complexity and context length. No per-request table is published [S3]. Use cheaper models for routine edits.

## WorkBuddy

What it is. A desktop AI agent for macOS and Windows. You describe a task, it plans and executes, including on authorised local folders [S13][S14]. Sign-in is Google or GitHub OAuth. It needs internet [S14]. UI and docs come in English.

Building blocks:
- Expert Center: ready-made role personas, 100+ per the promo page [S22].
- Skill Marketplace: official and community skills, scanned before install. "Local Whisper" speech-to-text is featured [S17].
- Custom skills: ask WorkBuddy to create one. Docs describe `skill.yml`, implementation files and a README [S18].
- Connectors: GitHub, GitLab, Jira, Confluence, Google Drive, Gmail, Notion, Slack [S16].
- Automation: hourly, daily, weekly or one-time runs. Results can go to Slack, Telegram or Discord [S15].
- Remote control from Slack, Telegram or Discord. The computer must be on [S14].
- Permission modes: Default (risky actions stop for confirmation) and Full Access [S21]. A ready human-in-control example.
- Models: built-in list plus custom models. It reads the same `~/.codebuddy/models.json` as CodeBuddy [S19].

Sharing. The Team plan lists "create, version and deploy custom agents" and team-shared skills, experts and knowledge base [S22]. Enterprise lists OpenAPI access and cloud agent hosting [S23]. We found no share link or API for a personal-plan agent.

Pricing. Free 100 credits a month. Pro USD 10 for 2,000. New users get 250 credits valid 14 days [S20].

## ADP and other Tencent services

ADP. A hosted platform with standard (RAG chat), single workflow and multi-agent modes [S26]. The workflow canvas has LLM, code, parameter extraction, condition and reply nodes [S27]. Multi-agent mode lets you add several agents and switch collaboration methods [S28]. It has a knowledge base, a Model Marketplace, and publishing to LINE, Telegram, WeChat and DingTalk [S26]. After publishing you get an AppKey and call the Chat API by WebSocket or HTTP SSE [S30]. Governance: an Approval Center where a named approver must grant each release, plus RBAC and audit logs [S24][S31]. This maps to Keppel's "approved before release". There is an English International edition [S24]. Free plan: claim once on first activation, valid 30 days. 1 credit = USD 0.001. A 10K credit pack costs USD 10 [S25][S32]. It needs a Tencent Cloud account.

Agent Runtime (AGS). A cloud sandbox for agent code, shell, browser and mobile sessions, compatible with the E2B SDK [S35]. Not needed for version one. It only matters if pills run untrusted code.

Miora. Tencent's creative agent studio: image, video, UI/UX and 3D on one canvas [S38]. Use it for the required 16:9 cover image, the solution diagram and demo video assets only.

TRTC ASR and TTS. TRTC Conversational AI gives streaming speech-to-text with timestamps, hotwords and silence detection, plus TTS [S36]. Tencent Cloud also sells standalone ASR [S37]. This matters: a voice interview is the natural way to capture undocumented know-how. Hotwords help with building jargon.

## Models and APIs

- CodeBuddy: a secondary review says the international build offers Claude, GPT and Gemini, plus Tencent Hunyuan (Hy) models [S40]. The Free plan has all models during the promo [S2].
- ADP: preset Tencent YouTu and DeepSeek models. Third-party models are added with your own API key [S29]. The ADP blog names Gemini and GPT [S42].
- TokenHub: Tencent Cloud's model gateway. It exposes an OpenAI-compatible `/v1/chat/completions` endpoint and an Anthropic-compatible Messages endpoint. Models include Hunyuan, DeepSeek, GLM, Kimi and MiniMax. New users get up to 1 million free tokens. A Lite plan is USD 7 [S33][S34][S22]. This is the API to call from our own app. Switching vendor later is a base URL change.

## Gotchas

- Two editions. Use codebuddy.ai, not the China site. Keys and the `CODEBUDDY_INTERNET_ENVIRONMENT` setting differ [S5].
- A Tencent Cloud account (ADP, TokenHub, ASR) needs a mobile number with an SMS code. The country cannot be changed later [S39].
- Credits expire. Monthly credits do not roll over [S3]. New-user WorkBuddy credits last 14 days [S20].
- The ADP free plan is 30 days, once per account [S32]. Claimed on 18 Sep, it dies before Demo Day on 3 Nov. Claim around 5 Oct.
- WorkBuddy runs on a laptop. Automations stop when it is off [S14].
- `models.json` holds the real API key in plain text [S9]. The repo will be public, so never commit it.
- Agent Runtime's quick start is in Chinese [S35].

## Proof of usage

The handbook requires at least 3 screenshots or a screen recording of CodeBuddy or WorkBuddy chats from development. API logs or a written process note also count. No proof, no scoring [S41].

From day one:
1. Make a `proof/` folder in the repo.
2. Screenshot every real session with the date visible. Aim for 10 or more: plan, build, debug, pill authoring.
3. Save CLI runs with `--output-format stream-json` into `proof/logs/` [S4].
4. Export WorkBuddy logs: Help, then Open Log Folder [S14].
5. Screenshot the credit usage page weekly [S3].
6. Keep `BUILD-LOG.md`: date, tool, prompt, result. It feeds the demo video's build reflection.

## Recommended stack

Primary recommendation.

Open files (the portable core):
- One Git folder per pill: `pill.yaml` (scope, owner, approver, version, escalation rules), `knowledge.md`, `rules.yaml` (decision logic), `guardrails.yaml`, `tests.jsonl` (expert-checked cases), `feedback.jsonl`.
- Git tags give versions and rollback. A pull request is the approval step.
- A small compiler exports each pill as a `SKILL.md` folder, and optionally as an ADP knowledge base plus prompt. Knowledge flows out from Git only.

Built in CodeBuddy:
- The web app: interview capture, pill registry, approve screen, and the Asset Operations Manager console showing sources and the escalation reason.
- The pill compiler, and an MCP server with `list_pills`, `get_pill`, `log_feedback`, `request_approval`.
- Coordinator and specialist agents in plain Python or TypeScript, calling one OpenAI-compatible client pointed at TokenHub.
- Use Plan Mode and sub-agents while building, and screenshot them.

Run in WorkBuddy:
- The expert interview, using a custom interviewer skill, with Tencent ASR or Local Whisper for voice.
- Pills installed as skills, to show reuse.
- A weekly Automation that drafts a feedback digest for the pill owner.

Run in ADP (optional bonus): a hosted demo agent with a public link, and the Approval Center for the governance story.

Fallback. If WorkBuddy or ADP is unavailable or too limited, go CodeBuddy only. It meets the hard rule alone. Load pills as CodeBuddy skills and sub-agents, run them headless, host the web app anywhere, and transcribe with local Whisper. If TokenHub fails, swap the base URL to another OpenAI-compatible provider. If CodeBuddy fails, WorkBuddy alone still meets the rule.

## Unverified

- Singapore availability of CodeBuddy, WorkBuddy and Miora. No page states it. The Singapore hackathon implies it.
- The CodeBuddy international model list. Secondary review only.
- Credits per request. No official number, so "what 1,000 credits buys" is an estimate.
- Whether hackathon credits expire.
- Whether WorkBuddy accepts custom MCP servers or `SKILL.md` skills. The handbook says "MCP connectors". The docs we read show only `skill.yml` and built-in connectors.
- Whether a personal WorkBuddy agent can be shared by link or API.
- What the ADP free plan contains. A third-party listing says 10,000 credits and 1 GB knowledge base.
- Whether ADP has an in-conversation human approval node. We confirmed release approval only.
- The exact TokenHub international base URL. Third-party docs show both tokenhub-intl.tencentmaas.com and tokenhub-intl.tencentcloudmaas.com. Check the console.
- Whether Tencent Cloud International asks for a payment card at sign-up.
- Agent Runtime availability on the international console.
- ASR accuracy for Singapore-accented English.
- Rate limits and outage history: nothing found.
- Not reachable: codebuddy.ai/pricing and workbuddy.ai/pricing returned empty content. For miora.design only the meta description was read. eigent.ai/blog/workbuddy-ai-review failed to load.

## Sources

- [S1] https://www.codebuddy.ai/docs/cli/overview
- [S2] https://www.codebuddy.ai/docs/ide/Account/pricing
- [S3] https://www.codebuddy.ai/docs/ide/Account/credits
- [S4] https://www.codebuddy.ai/docs/cli/headless
- [S5] https://www.codebuddy.ai/docs/cli/sdk
- [S6] https://www.codebuddy.ai/docs/cli/sub-agents
- [S7] https://www.codebuddy.ai/docs/cli/skills
- [S8] https://www.codebuddy.ai/docs/cli/mcp
- [S9] https://www.codebuddy.ai/docs/cli/models
- [S10] https://www.codebuddy.ai/docs/ide/Features/Plan-Mode
- [S11] https://www.codebuddy.ai/docs/ide/Getting-Started/Installation
- [S12] https://www.codebuddy.ai/docs/cli/agent-teams
- [S13] https://www.workbuddy.ai/docs/workbuddy/Overview
- [S14] https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/FAQ
- [S15] https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Automation-Guide
- [S16] https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Connector
- [S17] https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Skills-Market
- [S18] https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Practice-Cases/Create-Skills
- [S19] https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Model
- [S20] https://www.workbuddy.ai/docs/workbuddy/Subscription
- [S21] https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Permission-Modes
- [S22] https://www.tencentcloud.com/act/pro/workbuddy
- [S23] https://intl.cloud.tencent.com/products/workbuddyenterprise
- [S24] https://adp.tencentcloud.com/
- [S25] https://adp.tencentcloud.com/pricing
- [S26] https://www.tencentcloud.com/document/product/1254
- [S27] https://www.tencentcloud.com/document/product/1254/72136
- [S28] https://www.tencentcloud.com/document/product/1254/73337
- [S29] https://www.tencentcloud.com/document/product/1254/73342
- [S30] https://www.tencentcloud.com/document/product/1254/69977
- [S31] https://www.tencentcloud.com/document/product/1254/79058
- [S32] https://www.tencentcloud.com/document/product/1254/77441
- [S33] https://www.tencentcloud.com/act/pro/tokenhub
- [S34] https://docs.litellm.ai/docs/providers/tencent
- [S35] https://github.com/TencentCloudAgentRuntime/ags-cookbook
- [S36] https://trtc.io/solutions/conversational-ai
- [S37] https://www.tencentcloud.com/products/asr
- [S38] https://miora.design/
- [S39] https://www.tencentcloud.com/document/product/378/17985
- [S40] https://www.francisokafor.com/tools/tencent-codebuddy (secondary, via search results)
- [S41] Handbook pages 36 to 40 (official hackathon handbook; summary in docs/challenge/keppel-brief.md)
- [S42] https://adp.tencentcloud.com/en/blog/multi-agent-system-practice
