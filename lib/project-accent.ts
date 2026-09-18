import { PERSONAL_PROJECT_ID, type ProjectHues, projectAccentForHue } from "./accent";

export const PROJECT_SELECTOR = "[data-sidebar-project-id]";
export const ACTIVE_HEADING_SELECTOR = "[data-workspace-active]";
export const ACCENT_PROPERTY = "--bb-workspace-accent";

export function projectIdOf(element: Element): string | null {
  const id = element.getAttribute("data-sidebar-project-id");
  return id && id !== PERSONAL_PROJECT_ID ? id : null;
}

/* Set the per-project accent inline on every sidebar project element under
   root whose id has an assigned hue, and clear it from elements this call
   previously decorated that have since disappeared, lost their id or lost
   their assignment. Managed elements are remembered so a later clear never
   touches an inline value the plugin did not write. Returns every project id
   present (assigned or not) so the caller can request missing assignments. */
export function applyProjectAccents(root: ParentNode, managed: Set<HTMLElement>, hues: Readonly<ProjectHues>): string[] {
  const seen = new Set<HTMLElement>();
  const present = new Set<string>();
  for (const element of Array.from(root.querySelectorAll<HTMLElement>(PROJECT_SELECTOR))) {
    const id = projectIdOf(element);
    if (!id) continue;
    present.add(id);
    const hue = hues[id];
    if (hue === undefined) continue;
    const color = projectAccentForHue(hue);
    if (element.style.getPropertyValue(ACCENT_PROPERTY) !== color) element.style.setProperty(ACCENT_PROPERTY, color);
    seen.add(element);
    managed.add(element);
  }
  for (const element of Array.from(managed)) {
    if (seen.has(element)) continue;
    element.style.removeProperty(ACCENT_PROPERTY);
    managed.delete(element);
  }
  return Array.from(present);
}

export function clearProjectAccents(managed: Set<HTMLElement>): void {
  for (const element of managed) element.style.removeProperty(ACCENT_PROPERTY);
  managed.clear();
}

export interface ProjectAccentsHandle {
  /* Re-read hues and repaint now (call after the hues map changes). */
  refresh(): void;
  dispose(): void;
}

/* Keep sidebar project elements decorated while the signal is live. getHues
   is read on every repaint; onProjects receives the ids present after each
   repaint. Abort clears every inline value written and stops observing. */
export function mountProjectAccents(root: HTMLElement, signal: AbortSignal, getHues: () => Readonly<ProjectHues>, onProjects?: (ids: string[]) => void): ProjectAccentsHandle {
  const managed = new Set<HTMLElement>();
  let frame = 0;
  let disposed = false;
  const refresh = () => {
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    if (disposed) return;
    const ids = applyProjectAccents(root, managed, getHues());
    onProjects?.(ids);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(refresh); };
  const observer = new MutationObserver(schedule);
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-sidebar-project-id"] });
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    if (frame) cancelAnimationFrame(frame);
    clearProjectAccents(managed);
  };
  signal.addEventListener("abort", dispose, { once: true });
  if (signal.aborted) dispose(); else refresh();
  return { refresh, dispose };
}

/* The project id the Workspaces plugin marks active in the sidebar, if any. */
export function activeSidebarProjectId(root: ParentNode): string | null {
  const heading = root.querySelector(ACTIVE_HEADING_SELECTOR);
  const project = heading?.closest(PROJECT_SELECTOR);
  return project ? projectIdOf(project) : null;
}

/* Which project the rest of the window (pane headers, composer glow, pane
   wash) should follow. The route is authoritative: a routed project wins; a
   routed thread without a project is a personal thread and gets no project.
   Only on surfaces with neither (home, settings, plugin panels) does the
   Workspaces active heading in the sidebar decide. */
export function currentProjectId(route: { projectId: string | null; threadId: string | null }, root: ParentNode): string | null {
  if (route.projectId && route.projectId !== PERSONAL_PROJECT_ID) return route.projectId;
  if (route.projectId === PERSONAL_PROJECT_ID || route.threadId) return null;
  return activeSidebarProjectId(root);
}

/* Re-run onChange whenever the active heading or sidebar structure changes. */
export function watchActiveProject(root: HTMLElement, onChange: () => void, signal: AbortSignal): void {
  let frame = 0;
  const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; onChange(); }); };
  const observer = new MutationObserver(schedule);
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-workspace-active", "data-sidebar-project-id"] });
  signal.addEventListener("abort", () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame); }, { once: true });
}
