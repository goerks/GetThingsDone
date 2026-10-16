import { useId, useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

export interface DeckCard {
  /** Stable id of the card; also what the choice reports. */
  id: string;
  /** What the card shows. */
  label: string;
  /** What a screen reader reads for the card, without the state. */
  name: string;
  /** The key of the reference story of this value, shown on the card. */
  reference?: string;
}

interface Props {
  cards: readonly DeckCard[];
  /** The id of the chosen card, or null. */
  value: string | null;
  /** The visible label of the field names the group. */
  labelledBy: string;
  /** Called with the id of the card, or null when the chosen card is chosen again. */
  onChange(id: string | null): void;
}

/**
 * A row of cards to estimate with (#54). One card is chosen; choosing it again takes the estimate back. The arrow
 * keys move between the cards, Enter or space chooses.
 */
export function EstimateCards({ cards, value, labelledBy, onChange }: Props) {
  const { t } = useTranslation();
  const uid = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  // The card that takes the tab stop: the chosen one, or the first.
  const stop = Math.max(0, cards.findIndex((card) => card.id === value));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const current = refs.current.findIndex((node) => node === document.activeElement);
    if (current < 0) return;
    let next: number | undefined;
    if (event.key in keys) next = (current + keys[event.key] + cards.length) % cards.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = cards.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    refs.current[next]?.focus();
  };

  return (
    <div className="deck" role="radiogroup" aria-labelledby={labelledBy} onKeyDown={onKeyDown}>
      {cards.map((card, index) => {
        const chosen = card.id === value;
        return (
          <button
            key={card.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={chosen}
            aria-label={card.reference ? t('estimate.cardWithReference', { card: card.name, code: card.reference }) : card.name}
            id={`${uid}-${card.id}`}
            tabIndex={index === stop ? 0 : -1}
            className={`deck__card${chosen ? ' deck__card--chosen' : ''}${card.reference ? ' deck__card--reference' : ''}`}
            onClick={() => onChange(chosen ? null : card.id)}
          >
            <span className="deck__label" aria-hidden="true">
              {card.label}
            </span>
            {card.reference && (
              <span className="deck__ref" aria-hidden="true">
                {card.reference}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
