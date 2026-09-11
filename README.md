# Compact UI for bb

Tighter desktop panes, a steady composer and a configurable accent for [bb](https://github.com/get-bb/bb).

This is the published v0.6.0 implementation, displayed here as **Compact UI**. Its package and plugin identity remain `bb-plugin-compact-panes` / `compact-panes`, so the display-name change does not move existing settings to a new data directory. The installed v0.6.0 may still display “Compact Panes”.

## What it changes

- Pane headers shrink from 48px to 40px.
- Desktop composers keep the model selector and send controls visible instead of sliding upward on focus in narrow/short panes. Explicit manual collapse and mobile behaviour stay host-owned.
- Model/tool controls use 11px labels and 24px targets; the send button is 24×24px.
- The folder/environment strip uses 10px labels in a 20px row.
- Smaller side and bottom padding returns space to conversation content. The editor keeps a 68px minimum and can grow for longer drafts.
- Pane dividers are more visible; the selected main pane gets a faint 3% accent wash. Nested side panels do not receive an extra wash.

Spacing rules apply only at desktop widths (768px+) with a fine pointer. Voice-active and manually collapsed composer controls retain their host sizing. Disabling the plugin removes its compact-UI marker and restores the host’s spacing.

## Accent settings

Open **Settings → Plugins → Compact UI → Workspace accent**. Choose Green, Blue, Violet, Rose, Amber or Teal, or use the native colour picker/hex field and **Apply**. Presets save immediately; custom colours save on Apply. **Reset to green** restores bb’s theme-native green.

The accent is stored in this plugin’s bb-managed key/value storage and updates connected windows. Invalid input is rejected, and save errors are displayed. A fresh window can briefly show green while its saved accent loads.

When [Workspaces](https://github.com/mgmobrien/bb-plugin-workspaces) is installed, the same accent controls its sidebar rail/icon/title, pane headers and input glow. Compact UI alone supplies the tighter spacing, dividers and selected-pane tint. Neither plugin changes bb’s global success/error colours. Disabling Compact UI returns Workspaces to its native green fallback.

## Install from source

Requires bb 0.42+ and Node/npm. This snapshot was exercised with bb 0.42.1 and plugin SDK 0.4.47.

```sh
git clone https://github.com/mgmobrien/bb-plugin-compact-ui.git
cd bb-plugin-compact-ui
npm ci
npm run typecheck
npm run build
bb plugin install .
```

Keep this directory at a durable location: local-path installation reads its source here. If you already have `compact-panes`, install this source under that same package identity rather than removing the plugin and its saved setting.

## Compatibility and verification

The styling uses host DOM attributes and CSS variables, including composer container-query flags. These are not all stable public SDK contracts; bb updates may need corresponding changes. The 10px footer text is deliberately compact and may be too small for some users.

Source review and isolated Chromium fixtures checked steady composer geometry, toolbar/footer sizing, padding, selected-pane scoping and accent behaviour. Tests of the actual React settings component used a mocked SDK transport; colour samples used compiled plugin CSS and bb’s installed CSS in Chromium. Across six presets and additional light/dark test colours, green remained pixel-identical and measured title/indicator contrast cleared 4.5:1/3:1 in the default themes. Custom themes were not validated.

Private fixture artifacts and live settings are not included in this repository. Upcoming sidebar spacing/heading/hover changes are not part of v0.6.0.

Built with **MattBot — Matt’s AI assistant (GPT-6 Astra today)**.
