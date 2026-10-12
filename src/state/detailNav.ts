import { createContext } from 'react';

/**
 * Stepping through a list of items while a detail dialog is open, such as search results.
 * The dialog shows it as a bar above its content.
 */
export interface DetailNav {
  /** Describes the list, for example the search text. */
  label: string;
  /** 1-based position of the open item. */
  position: number;
  total: number;
  previous: (() => void) | null;
  next: (() => void) | null;
  back: () => void;
}

/** The navigation bar of the open detail dialog. Dialogs inside a detail dialog reset it to null. */
export const DetailNavContext = createContext<DetailNav | null>(null);
