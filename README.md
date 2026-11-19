# Thomas

A local, English-first personal page: warm paper, tangerine avatar, quiet typography and live optical glass. Plain HTML/CSS/JavaScript; no build step or runtime CDN.

## Preview

```sh
cd /Users/thomaschiu/Public/Grok/Thomas_Website
/usr/bin/python3 preview.py
```

Use http://127.0.0.1:4175/. The existing preview is bound to loopback only. Do not start a second copy while it is running. Nothing is deployed.

## Glass

The unmodified MIT apple-liquid-glass-webgl 2.6.0 package is imported through its public `LiquidGlass` API (`src/index.js`). Each surface uses `backdrop: 'auto'`: the vendor captures page content below that surface in paint order, then refracts it in WebGL2. Typography, images, links and icons remain DOM children above their lens.

Four contexts provide separate capture boundaries for the avatar, work panel, dock and selected pill. This lets the dock capture the page and the selected pill capture the dock. Grouping the entire body as one target host would exclude the underlying typography from auto capture. The CSS surfaces have no painted rainbow rims, milky backgrounds or inset frames. `rim.js` and the global `#optics` canvas were removed.

The visible paper canvas supplies fine grain, directional daylight and actual cast shadows. Shadows are painted onto the visible sheet because the vendor does not capture CSS box-shadow. They update with scrolling and disclosures. This canvas is only one layer of the auto-captured page, not a substitute for the DOM backdrop. Shader dispersion separates backdrop color channels; it is strongest over contrast edges and real text, not a constant rainbow outline.

Rendering refreshes on scroll, resize and DOM changes, and during the short selected-pill transition. There is no perpetual animation loop. DPR is capped at 2. Missing WebGL2 uses the documented CSS fallback; reduced transparency can become opaque. Reduced motion removes CSS transitions. No physical iPhone performance claim is made.

## Content

Replace `assets/avatar.jpg` to swap the tangerine image. Northwater Labs opens its real URL in a new tab. NotchMove, Photography and Trading & investing use native inline disclosures. Photography and social accounts are honestly coming soon. Contact is thomas@northwaterlabs.com. The four labeled dock links support keyboard navigation.

## Verification

`output/playwright/redo-check.cjs` captures desktop, mobile and reference-sized mobile in Chromium and WebKit. `redo-interactions.cjs` checks tabs, details, keyboard, contact clearance, responsive widths, reduced motion and actual WebGL capability denial. `redo-optics.cjs` temporarily moves the existing panel over the existing bio, verifies that changing underlying DOM text changes the lens pixels, and captures diagnostic refraction screenshots. These temporary diagnostic changes are not saved to the page.

Screenshots and JSON reports use the `redo-` prefix. WebKit engine tests do not replace physical iOS Safari testing. The fallback is blur-based and cannot reproduce shader refraction. On near-white paper, dispersion is intentionally source-dependent and less saturated than over photographic imagery.

See [vendor attribution](vendor/NOTICE.md).
