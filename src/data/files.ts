/**
 * Saves a text as a file through the browser (#16). The browser build downloads it; the desktop app's web view
 * does the same. Kept apart so the tests can replace it.
 */
export function downloadTextFile(name: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before the address goes away.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
