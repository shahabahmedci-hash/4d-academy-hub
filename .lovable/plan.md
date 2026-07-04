## Phase A — Ads on dashboards

Match the original app: fixed bottom banner on the three role dashboards, mobile-aware, auto-cooldown/dismiss already handled by existing `AdBanner`.

1. **Mount `<AdBanner />`** (default fixed variant) at the bottom of:
   - `src/pages/admin/AdminDashboard.tsx`
   - `src/pages/student/StudentDashboard.tsx`
   - `src/pages/teacher/TeacherDashboard.tsx`
   Rendered just before the closing wrapper, after `<BottomNav />`. `AdBanner` already offsets itself above the bottom nav (`bottom: 64`) and self-hides until the Adsterra script loads.
2. **Keep** existing `src/lib/adConfig.ts` (real Adsterra key `b024d75e6c3bd263a57f21a31e7c1d85`, 320×50, `enabled: true`) — no changes needed.
3. **Verify** in preview on mobile viewport that the banner appears above the bottom nav on all three dashboards and the dismiss (×) + 10s cooldown re-show works.

No new files, no config changes, no backend work.

## Phase B — Switch AI edge function to OpenRouter (free open-source model)

Replace Lovable AI Gateway call in `supabase/functions/ai-analytics/index.ts` with OpenRouter using a free model.

1. **Request the secret** via `add_secret` for `OPENROUTER_API_KEY` (user grabs from https://openrouter.ai/keys — free tier available).
2. **Edit `supabase/functions/ai-analytics/index.ts`**:
   - Change endpoint to `https://openrouter.ai/api/v1/chat/completions`.
   - Auth header: `Authorization: Bearer ${Deno.env.get("OPENROUTER_API_KEY")}`.
   - Add OpenRouter recommended headers: `HTTP-Referer` and `X-Title` (app name).
   - Swap model id to `meta-llama/llama-3.1-8b-instruct:free` (open-source Llama, free tier). Keep the same request/response shape (OpenAI-compatible).
   - Update 402/429 error surfacing text to reference OpenRouter rate limits / credit exhaustion.
3. **Keep** `LOVABLE_API_KEY` present for other Lovable services (connectors); we're only swapping this one function.
4. **Verify** by calling the function from the Admin → Analytics page (AIInsightsPanel) and checking edge function logs for a 200 response.

### Technical notes
- OpenRouter is OpenAI-compatible, so only URL + auth header + model id change; JSON body (`messages`, `temperature`, etc.) stays identical.
- Free model rate limits are ~20 req/min, ~200/day — fine for an analytics panel.
- If the user later wants a stronger free model, easy swap to `deepseek/deepseek-chat-v3.1:free` or `google/gemini-2.0-flash-exp:free`.

## Out of scope
- Other edge functions (`send-fee-reminders`, `automation-dispatcher`, etc.) — none currently call an AI model.
- Ad placement on non-dashboard pages (per your answer: dashboards only).
- Landing/Auth ads.

Approve to run both phases; I'll do Phase A first, then request the OpenRouter key for Phase B.
