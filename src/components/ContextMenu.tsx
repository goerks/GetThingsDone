import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

export interface MenuItem {
  id: string;
  label: string;
  /** A small colour dot in front of the label (status). */
  dot?: string;
  /** The current value in a list of choices; shown with a tick and announced as checked. */
  checked?: boolean;
  /** Choices of a submenu; the item then only opens it. */
  submenu?: MenuItem[];
  onSelect?: () => void;
}

interface Props {
  /** Where the menu opens, in window coordinates. */
  x: number;
  y: number;
  label: string;
  items: MenuItem[];
  onClose: () => void;
}

/** Keeps a menu inside the window: shifted left or up when it would stick out. */
function clamp(node: HTMLElement | null, x: number, y: number): { left: number; top: number } {
  const width = node?.offsetWidth ?? 0;
  const height = node?.offsetHeight ?? 0;
  return {
    left: Math.max(4, Math.min(x, window.innerWidth - width - 4)),
    top: Math.max(4, Math.min(y, window.innerHeight - height - 4))
  };
}

interface ListProps {
  items: MenuItem[];
  label: string;
  /** Index to focus first; -1 for none. */
  focusIndex: number;
  nested: boolean;
  onClose: () => void;
  onBack?: () => void;
}

/** One level of the menu. Up and down move, Right opens a submenu, Left or Escape goes back, Enter chooses. */
function MenuList({ items, label, focusIndex, nested, onClose, onBack }: ListProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [flip, setFlip] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusIndex >= 0) refs.current[focusIndex]?.focus();
  }, [focusIndex]);

  // A submenu that would leave the window opens to the left.
  useLayoutEffect(() => {
    if (!nested) return;
    const rect = listRef.current?.getBoundingClientRect();
    if (rect && rect.right > window.innerWidth - 4) setFlip(true);
  }, [nested]);

  const move = (from: number, step: number): void => {
    const next = (from + step + items.length) % items.length;
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    // Keys from a submenu belong to that submenu.
    if (!refs.current.includes(event.target as HTMLButtonElement)) return;
    const index = refs.current.findIndex((node) => node === document.activeElement);
    const current = index >= 0 ? index : 0;
    if (event.key === 'ArrowDown') move(current, 1);
    else if (event.key === 'ArrowUp') move(current, -1);
    else if (event.key === 'Home') refs.current[0]?.focus();
    else if (event.key === 'End') refs.current[items.length - 1]?.focus();
    else if (event.key === 'ArrowRight' && items[current]?.submenu) setOpen(current);
    else if (event.key === 'ArrowLeft' && onBack) onBack();
    else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (onBack && event.currentTarget.contains(document.activeElement)) onBack();
      else onClose();
      return;
    } else if (event.key === 'Tab') onClose();
    else return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div ref={listRef} role="menu" aria-label={label} className={`ctx-menu${nested ? ' ctx-menu--nested' : ''}${flip ? ' ctx-menu--flip' : ''}`} onKeyDown={onKeyDown}>
      {items.map((item, index) => {
        const hasSub = Boolean(item.submenu);
        return (
          <div key={item.id} className="ctx-menu__row" onMouseEnter={() => hasSub && setOpen(index)}>
            <button
              type="button"
              ref={(node) => {
                refs.current[index] = node;
              }}
              role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
              aria-checked={item.checked}
              aria-haspopup={hasSub ? 'menu' : undefined}
              aria-expanded={hasSub ? open === index : undefined}
              tabIndex={-1}
              className="ctx-menu__item"
              onClick={() => (hasSub ? setOpen(index) : item.onSelect?.())}
              onMouseEnter={() => !hasSub && setOpen(null)}
            >
              {item.dot && <span className="ctx-menu__dot" style={{ background: item.dot }} aria-hidden="true" />}
              <span className="ctx-menu__label">{item.label}</span>
              {item.checked && (
                <span className="ctx-menu__tick" aria-hidden="true">
                  ✓
                </span>
              )}
              {hasSub && (
                <span className="ctx-menu__arrow" aria-hidden="true">
                  ▸
                </span>
              )}
            </button>
            {hasSub && open === index && item.submenu && (
              <MenuList
                items={item.submenu}
                label={item.label}
                nested
                focusIndex={Math.max(0, item.submenu.findIndex((choice) => choice.checked))}
                onClose={onClose}
                onBack={() => {
                  setOpen(null);
                  refs.current[index]?.focus();
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * A menu at a point of the window, for the right click, the menu key and Shift+F10 (#32, Q1).
 * A transparent layer behind it takes the click beside the menu, so that click only closes the menu.
 */
export function ContextMenu({ x, y, label, items, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState({ left: x, top: y });
  useLayoutEffect(() => setPlace(clamp(box.current, x, y)), [x, y]);

  return createPortal(
    <>
      <div
        className="ctx-backdrop"
        onPointerDown={(event) => {
          event.preventDefault();
          onClose();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          onClose();
        }}
      />
      <div ref={box} className="ctx-box" style={{ left: place.left, top: place.top }}>
        <MenuList items={items} label={label} nested={false} focusIndex={0} onClose={onClose} />
      </div>
    </>,
    document.body
  );
}
