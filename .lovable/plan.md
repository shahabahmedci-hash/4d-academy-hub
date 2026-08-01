## Diagnosis

No new Adsterra link/key is needed. Your key and config in `src/lib/adConfig.ts` are real, `enabled: true`, and `AdBanner` is mounted globally in `App.tsx` plus on all three dashboards and the landing page. The network snapshot shows **zero requests to `highperformanceformat.com`**, so the ad script is never producing a creative.

Two causes, in order of likelihood:

1. **Injection method is incompatible with Adsterra.** `AdBanner` creates a `<script src=...invoke.js async>` and appends it into a div after React renders. Adsterra's `invoke.js` writes its banner with `document.write()`, which is a no-op once the document has finished parsing — so nothing ever renders and the `MutationObserver` never fires, leaving the fixed banner permanently `display:none`. The supported pattern (and what ad networks expect) is to run `atOptions` + `invoke.js` inside a **fresh document**, i.e. an `<iframe>` with `srcdoc`.
2. **Preview/adblock environment.** Inside the Lovable preview iframe and with any ad blocker or tracking protection, Adsterra requests are commonly blocked. Ads should be verified on the **published URL** in a normal tab, not in the editor preview.

## What to change

**`src/components/shared/AdBanner.tsx`** — rewrite the render path:
- Replace the script-injection approach with an `<iframe>` of exactly the ad size (320x50 mobile / configured size desktop), `scrolling="no"`, no border, `srcdoc` containing:
  ```html
  <html><body style="margin:0">
    <script>atOptions = {...}</script>
    <script src="https://www.highperformanceformat.com/<key>/invoke.js"></script>
  </body></html>
  ```
- Use an explicit `https:` scheme instead of the protocol-relative `//` URL.
- Keep existing behaviour: `inline` vs fixed-bottom variant, bottom-nav offset, dismiss button, cooldown re-show, mobile/desktop config switch.
- Replace the fragile `MutationObserver`-based `adLoaded` gate with the iframe `onLoad` event (plus a timeout fallback), so the fixed banner is no longer hidden forever when detection fails.
- Keep the "Ad Space" dashed placeholder for when keys aren't configured.

**`src/lib/adConfig.ts`** — no key change required; only add the full `https://` script src if we move the URL there.

## Verification

- Confirm a request to `highperformanceformat.com/.../invoke.js` appears in the network panel after the change.
- Check on the published URL with ad blockers off — Adsterra also does not serve on `localhost`/preview domains until the domain is approved in your Adsterra dashboard.

## Note on your Adsterra account

If requests fire but no creative shows, the remaining item is account-side: the site/domain must be added and **approved** in the Adsterra publisher dashboard, and the ad unit's domain must match where it's served. That would be the only case where you need a fresh ad-unit link — generated for the new domain.
