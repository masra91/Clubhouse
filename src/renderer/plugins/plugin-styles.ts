export function injectStyles(pluginId: string, cssText: string): void {
  const id = `plugin-styles-${pluginId}`;
  // Remove existing if present
  removeStyles(pluginId);
  const style = document.createElement('style');
  style.id = id;
  style.textContent = cssText;
  document.head.appendChild(style);
}

export function removeStyles(pluginId: string): void {
  const id = `plugin-styles-${pluginId}`;
  const existing = document.getElementById(id);
  if (existing) {
    existing.remove();
  }
}
