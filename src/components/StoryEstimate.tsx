import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { estimatePatch, referencesByValue } from '../domain/estimation';
import { POINT_VALUES, SPECIAL_CARDS, type SpecialCard, type Story } from '../domain/types';
import { useDetails } from '../state/Details';
import { useApp } from '../state/AppState';
import { EstimateCards, type DeckCard } from './EstimateCards';
import { SPECIAL_SYMBOLS } from './estimateSymbols';
import { useBuiltin } from './useBuiltin';

/**
 * The estimate field of a story (#54): the Fibonacci cards with the special cards, the reference stories below, and
 * the choice to make this story the reference of its value.
 */
export function StoryEstimate({ story }: { story: Story }) {
  const { t } = useTranslation();
  const app = useApp();
  const details = useDetails();
  const builtin = useBuiltin();
  const uid = useId();
  const references = referencesByValue(app.stories);

  const cards: DeckCard[] = [
    ...POINT_VALUES.map((value) => ({ id: String(value), label: String(value), name: String(value), reference: references.get(value)?.code })),
    ...SPECIAL_CARDS.map((card) => ({ id: card, label: SPECIAL_SYMBOLS[card], name: t(`estimate.special.${card}`) }))
  ];
  const value = story.points !== null ? String(story.points) : story.special;

  const choose = (id: string | null): void => {
    if (id === null) app.updateStory(story.id, estimatePatch(null));
    else if ((SPECIAL_CARDS as readonly string[]).includes(id)) app.updateStory(story.id, estimatePatch({ special: id as SpecialCard }));
    else app.updateStory(story.id, estimatePatch({ points: Number(id) }));
  };

  const listed = POINT_VALUES.flatMap((card) => {
    const reference = references.get(card);
    return reference ? [{ card, reference }] : [];
  });

  return (
    <div className="field estimate">
      <span id={`${uid}-label`}>{builtin.label('points', t('detail.points'))}</span>
      <EstimateCards cards={cards} value={value} labelledBy={`${uid}-label`} onChange={choose} />
      {story.points !== null && (
        <label className="estimate__reference">
          <input type="checkbox" checked={story.reference} onChange={(event) => app.setReference(story.id, event.target.checked)} />
          {t('estimate.referenceFor', { value: story.points })}
        </label>
      )}
      <div className="estimate__references">
        <strong id={`${uid}-references`}>{t('estimate.references')}</strong>
        {listed.length === 0 ? (
          <p className="muted">{t('estimate.noReferences')}</p>
        ) : (
          <ul aria-labelledby={`${uid}-references`}>
            {listed.map(({ card, reference }) => (
              <li key={card}>
                <span className="estimate__value">{card}</span>
                {reference.id === story.id ? (
                  <span>{t('estimate.thisStory', { code: reference.code, title: reference.title })}</span>
                ) : (
                  <button type="button" className="link-button" onClick={() => details.openStory(reference.id)}>
                    {t('estimate.openReference', { code: reference.code, title: reference.title })}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
