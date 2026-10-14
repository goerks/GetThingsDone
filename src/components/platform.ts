/** Whether the app runs on an Apple system, where the shortcut key is Cmd instead of Ctrl. */
export const isMac = (): boolean => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** The name of the shortcut key on this system, as shown in hints. */
export const modKey = (): string => (isMac() ? '⌘' : 'Ctrl');
