---
name: Base Attribution OS
description: Light, readable attribution checks with inspectable source and onchain evidence.
colors:
  base-blue: "#0052ff"
  canvas: "#fbfbfa"
  surface: "#ffffff"
  border: "#eaeaea"
  text-main: "#2f3437"
  text-muted: "#787774"
  text-accent: "#111111"
  dash-muted: "#64645f"
  dash-rule: "#e5e6e5"
  explanation-bg: "#f0f4fc"
  status-good: "#32613b"
  status-review: "#96552a"
  testnet-text: "#805719"
typography:
  display:
    fontFamily: '"Instrument Serif", Georgia, "Times New Roman", serif'
    fontSize: "56px"
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  body:
    fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
    fontSize: "14px"
    lineHeight: 1.6
  data:
    fontFamily: '"JetBrains Mono", "SF Mono", "Geist Mono", Consolas, monospace'
    fontSize: "30px"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "4px"
  button: "6px"
  md: "8px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.base-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "9px 14px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "9px 14px"
---

# Design System: Base Attribution OS

## Overview

Preserve the existing light docs identity: BAO wordmark, Base blue, serif headlines, compact sans-serif explanations, and monospace evidence. The dashboard helps builders audit attribution before release and inspect published onchain samples afterward, alongside Base analytics.

## Colors

Use Base blue for primary actions, selection, focus, source coverage, and links. White panels sit on the warm canvas with quiet gray rules. Pale blue distinguishes explanatory content. Green, brown, and amber communicate verified attribution, review, and testnet context; pair color with text or icons.

## Typography

Instrument Serif carries the dashboard headline at 56px and explanatory/footer headings at 28px, all weight 400. Section headings use Plus Jakarta Sans at 16px/1.4, weight 600. Compact supporting copy uses 11–14px with readable line height. JetBrains Mono carries counts, hashes, Builder Codes, and block numbers; numeric totals use tabular figures. Keep scope explanations near their numbers, generally within 65–75ch.

## Layout

The shared container is centered at 1200px maximum with 24px horizontal padding, reducing to 16px below 768px. The desktop overview and detail area use a 1.65:1 split; stage explanations use three columns and sample totals four columns. Rules and spacing separate sections without enclosing every item in a card.
At 1050px the header stacks and toolbar wraps. At 720px overview/detail/stage sections become single columns, totals become two columns, the headline becomes 42px, network controls fill a new row, search fills the ledger width, and footer actions stack. Preserve the 320px document minimum.

## Elevation & Depth

Panels are mostly flat, using borders and tonal contrast. The active network segment has a small shadow; the shared wordmark and blue repository button retain their existing blue shadows. Dashboard actions change background and border over 150ms; reduced-motion preferences disable dashboard transitions.

## Shapes

Use 8px panel corners, 6px dashboard buttons and segmented-control containers, 4px badges/segments, and the existing 5px search field. Prefer thin rules, small stroke icons, and compact horizontal progress tracks.

## Components

Navigation keeps the BAO wordmark and visible Dashboard, Doctor, Observatory, and Smart Wallets links. Indicate the current page with `aria-current`; let navigation wrap on narrow screens.
Buttons have a 42px minimum height. Secondary actions use white surfaces and gray borders; primary actions use Base blue. Dashboard interactive elements receive a 2px blue `:focus-visible` outline with 4px offset; search also changes its container border on focus.
The project selector and network buttons update the selected sample; network selection uses `aria-pressed`. Source audit coverage stays independent of the network filter. Keep source findings, source snapshot provenance, and onchain sample totals visibly distinct.
The evidence ledger uses a semantic table with column headings, an 820px minimum width, and a horizontally scrollable, keyboard-focusable labeled region. Hash links identify the explorer and new-tab behavior. Rows use subtle hover backgrounds; statuses combine text and icons. Search and review filters affect rows while totals retain the full selected sample; export covers that full sample.
Use specific empty states, visible filter reset actions, live result/share feedback, and a native details disclosure for methodology. Show unavailable measurements explicitly rather than filling them with inferred values.

## Do's and Don'ts

- Do preserve the light palette, wordmark, three-font hierarchy, and inspectable evidence links.
- Do distinguish mainnet from testnet and snapshot time from current state.
- Do label source audits as static supported-path checks and onchain totals as published samples.
- Don't imply that a local source audit proves a hosted CI run passed, runtime completeness, deployment readiness, or contract safety.
- Don't invent activity, revenue, player counts, growth, referral attribution, or complete project coverage from proof samples.
