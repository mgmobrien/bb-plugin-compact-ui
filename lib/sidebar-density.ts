export function mountSidebarDensity(): () => void {
  const rootSelector = '[data-sidebar-sticky-stack]';
  const property = '--bb-compact-sidebar-offset';
  const marker = 'data-bb-compact-sidebar-offset';
  const managed = new Map<HTMLElement, { value: string; previous: string; priority: string; marker: string | null }>();
  let frame = 0;
  const media = window.matchMedia('(min-width: 768px) and (pointer: fine)');

  function restore(element: HTMLElement) {
    const state = managed.get(element);
    if (!state) return;
    if (element.style.getPropertyValue(property) === state.value) {
      if (state.previous) element.style.setProperty(property, state.previous, state.priority);
      else element.style.removeProperty(property);
    }
    if (state.marker === null) element.removeAttribute(marker);
    else element.setAttribute(marker, state.marker);
    managed.delete(element);
  }

  function refresh() {
    frame = 0;
    const seen = new Set<HTMLElement>();
    if (media.matches) {
      for (const element of Array.from(document.querySelectorAll<HTMLElement>(`${rootSelector} [style]`))) {
        const isLine = element.matches('span[aria-hidden="true"][class~="bg-border-hairline"]');
        const source = isLine ? element.style.left : element.style.paddingLeft;
        if (!/^\d+(?:\.\d+)?px$/.test(source)) continue;
        const base = isLine ? 16 : 8;
        const depth = (parseFloat(source) - base) / 24;
        if (!Number.isInteger(depth) || depth < 0) continue;
        const value = `${base + depth * 16}px`;
        seen.add(element);
        let state = managed.get(element);
        if (!state) {
          state = { value, previous: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property), marker: element.getAttribute(marker) };
          managed.set(element, state);
        }
        state.value = value;
        if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value);
        const kind = isLine ? 'line' : 'row';
        if (element.getAttribute(marker) !== kind) element.setAttribute(marker, kind);
      }
    }
    for (const element of managed.keys()) if (!seen.has(element)) restore(element);
  }

  function schedule() { if (!frame) frame = requestAnimationFrame(refresh); }
  const observer = new MutationObserver((records) => {
    if (records.some(record => record.target instanceof Element && (
      record.target.closest(rootSelector) !== null ||
      Array.from(record.addedNodes).some(node => node instanceof Element && (node.matches(rootSelector) || node.querySelector(rootSelector))) ||
      Array.from(record.removedNodes).some(node => node instanceof Element && (node.matches(rootSelector) || node.querySelector(rootSelector)))
    ))) schedule();
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
  media.addEventListener('change', schedule);
  refresh();
  return () => {
    observer.disconnect();
    media.removeEventListener('change', schedule);
    if (frame) cancelAnimationFrame(frame);
    for (const element of managed.keys()) restore(element);
  };
}
