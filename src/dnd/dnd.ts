import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, type SortingStrategy } from '@dnd-kit/sortable';
import type { Placement } from '../domain/board';

/**
 * Sensors for whole-card dragging.
 * Mouse: a drag starts after 4 px, so a click stays a click. Touch: hold for 150 ms, so the page still scrolls.
 * Keyboard: space picks up and drops, arrow keys move, escape cancels. Enter is left free to open a story.
 */
export function useDragSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter', 'Tab'] }
    })
  );
}

/**
 * Items keep their place while dragging. The drop position is shown as a line instead,
 * so the layout does not jump under the pointer.
 */
export const keepInPlace: SortingStrategy = () => null;

/**
 * Whether the dragged item is in the upper or lower half of the item it is over.
 * Keyboard drags move from item to item, so there the move direction decides (undefined).
 */
export function placementOf(event: DragMoveEvent | DragEndEvent): Placement | undefined {
  const { active, over, activatorEvent } = event;
  if (!over || activatorEvent instanceof KeyboardEvent) return undefined;
  const rect = active.rect.current.translated;
  if (!rect) return undefined;
  const middle = rect.top + rect.height / 2;
  return middle > over.rect.top + over.rect.height / 2 ? 'after' : 'before';
}

/** Where a dragged item would land: in front of `beforeId`, or at the end of its group when null. */
export interface DropTarget<Group extends string> {
  group: Group;
  beforeId: string | null;
}

/**
 * Finds the drop target from the list that a drop would produce.
 * `groupOf` names the group (column or section) of a story; `ordered` lists every item in display order.
 */
export function dropTargetIn<Item extends { id: string }, Group extends string>(
  ordered: readonly Item[],
  activeId: string,
  groupOf: (item: Item) => Group
): DropTarget<Group> | null {
  const index = ordered.findIndex((item) => item.id === activeId);
  if (index < 0) return null;
  const group = groupOf(ordered[index]);
  const next = ordered.slice(index + 1).find((item) => groupOf(item) === group);
  return { group, beforeId: next ? next.id : null };
}
