import { ACCENT_OPTION_KEYS, type AccentOptions } from "./accent";

/* 0.9.0: reflect the accent options onto the document element as attributes
   the stylesheets gate on. `data-bb-accent-<key>="off"` is present only while
   that surface is off and removed when it is on; passing all-on clears every
   attribute, which is what the overlay does on unmount. Pure: it only
   touches these four attributes and never reads other state. */
export function accentOptionAttribute(key: (typeof ACCENT_OPTION_KEYS)[number]): string {
  return `data-bb-accent-${key}`;
}
export function applyAccentOptions(html: Element, options: AccentOptions): void {
  for (const key of ACCENT_OPTION_KEYS) {
    const attribute = accentOptionAttribute(key);
    if (options[key]) {
      if (html.hasAttribute(attribute)) html.removeAttribute(attribute);
    } else if (html.getAttribute(attribute) !== "off") html.setAttribute(attribute, "off");
  }
}
