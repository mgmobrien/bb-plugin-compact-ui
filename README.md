# Compact UI for bb

Fit more threads and pane content on screen with tighter spacing and a configurable workspace accent.

The package is named `bb-plugin-compact-panes` and its bb ID remains `compact-panes`. The displayed name is **Compact UI**. It works independently and shares accent colors with [Workspaces](https://github.com/mgmobrien/bb-plugin-workspaces) when that plugin is installed.

## Compact spacing

- Shorter pane and right-panel headers with smaller controls.
- Tighter expanded composers, toolbars, environment strips and outer pane padding.
- Expanded tool cards, message action strips and user bubbles use less vertical space.
- Denser sidebar rows, project headings and nesting, while preserving bb's sticky-heading behavior.
- Expanded desktop split composers keep their controls visible instead of expanding on focus.

Desktop pane rules apply to both split panes and a single thread pane at desktop widths with a fine pointer. Single-pane layouts receive the same spacing, accent background, header and composer-focus treatments. Mobile/touch layouts, manually collapsed composers and voice controls retain their host behavior. Text content, keyboard shortcuts, drag targets and conversation virtualization remain owned by bb.

## Accent settings

Open **Compact UI** from the sidebar or Settings → Plugins → Compact UI. Both entry points use the same settings and live synchronization.

Choose Green, Blue, Violet, Rose, Amber or Teal, enter a six-digit hex color, or choose **None** for theme-native monochrome. Presets save immediately; custom colors use **Apply**. Reset restores bb's theme-native green.

**Per project** assigns distinct project colors and saves them on the plugin server. Adding a project leaves existing assignments unchanged. **Shuffle colors** reassigns the known projects. As the number of projects grows, the available separation between colors decreases. Personal threads and surfaces without a project use the fallback accent.

The accent follows the current project on supported headers, selected-pane backgrounds, dividers and composer focus treatments. Workspaces sidebar decorations share it when installed. No global success/error color token is changed. Light and dark tones adapt to bb's theme; contrast still depends on a custom theme's backgrounds and text colors.

Seven checkboxes control project headings, thread titles, active-workspace rails, the hover wash on open groups, pane header color, pane background wash and text input glow. Pane header color and text input glow control treatments provided by Workspaces when that separate plugin is installed; background wash is provided by Compact UI. **None** disables per-project coloring without discarding the saved mode or project assignments.

## Install from source

Requires bb 0.42+ and plugin SDK 0.4.47. Host selectors were developed against bb 0.42.1.

```sh
git clone https://github.com/mgmobrien/bb-plugin-compact-ui.git
cd bb-plugin-compact-ui
npm ci
npm run typecheck
npm run build
bb plugin install .
```

## Data and compatibility

Accent settings and project-to-hue assignments live in bb-managed plugin storage and synchronize to connected windows. No external account or service is required. Failed saves show an error; native green may appear briefly while saved settings load.

This plugin depends on internal host CSS and DOM attributes. A bb update can require selector changes. Disabling it removes its styles and content-script decorations; saved settings remain available for re-enabling it. It does not patch the bb application.

Built with **MattBot — Matt’s AI assistant (GPT-6 Astra today)**.
