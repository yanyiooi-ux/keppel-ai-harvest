# Submission checklist

Form: https://tinyurl.com/TCHackathonSGProjectSubmission. Official deadline Fri 16 Oct 2026. **Our target: Thu 15 Oct.**
Draft every field here first, then paste into the form. What each item needs: `docs/challenge/submission-rules.md`.

| # | Item | Required? | Status | Draft or file |
|---|---|---|---|---|
| 1 | Project title | Required | not started | |
| 2 | Short blurb (**under 10 words**) | Required | not started | |
| 3 | Project description (4 parts below) | Required | not started | below |
| 4 | CodeBuddy chat history: 3+ screenshots or a recording | Required | not started | `proof/screenshots/` |
| 5 | Cover image, 16:9, about 380 x 216 px | Required | not started | `assets/cover.png` |
| 6 | Solution diagram answering Keppel's 8 questions | Required for this track | not started | `docs/solution/` |
| 7 | Live demo walkthrough | Required for this track | not started | live link and video |
| 8 | Demo video, 5 to 8 min | Optional in the form, **required for us** | not started | upload, link here (too big for git). Backup recording by Tue 13 Oct. |
| 9 | Project link (live URL, earns bonus points) | Optional | not started | |
| 10 | GitHub repo link (this repo) | Required for this track | private until submission | https://github.com/yanyiooi-ux/keppel-ai-harvest |

## Project description

### 1. Overview: target scenarios, users, value

_To write in prompt P16, from the real code._

### 2. Real-world insight: where the pain comes from, who has it, the core problem

_To write in prompt P16._

### 3. Solution design: business and technical architecture, and how prompts drive the AI

_To write in prompt P16. Must also cover the 8 questions (see `docs/solution/README.md`)._

### 4. Business value: numbers or clearly defined impact

_To write in prompt P16. Only numbers we can back; mark anything else as an estimate._

## Before making the repo public

Making the repo public shows every past commit, not only the latest files.

- [ ] Search the full history: `git log -p --all` for keys, `.env` values, `C:\Users`, personal email addresses and
      handbook passages.
- [ ] `git log --format=%ae | sort -u` shows only GitHub no-reply addresses.
- [ ] Nothing from `private/` or `web/.env.local` was ever committed.
- [ ] Every image in `proof/screenshots/` checked for private content.
- [ ] README is the judges' front page: what it does, how to run it, the demo link, the 8-question map, proof.
- [ ] Decide a licence (or state "all rights reserved").
- [ ] `proof/screenshots/` holds at least 3 dated development screenshots, ideally 10 or more.
