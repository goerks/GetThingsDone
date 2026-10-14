import { useRecorder } from '../../state/Recorder';

/*
 * The tab "Neuer Test" of the acceptance popup (#37): the way into the test builder. The builder itself is the bar on the
 * right edge; this tab says where things stand and copies the one text for the AI. In German like the rest of the popup.
 */
export function BuilderTab({ onCopy, copied }: { onCopy: () => void; copied: boolean }) {
  const recorder = useRecorder();
  const { collection, draft } = recorder.state;
  const recording = draft !== null && !draft.editing;
  const steps = draft?.test.steps.length ?? 0;

  return (
    <div className="acceptance__builder">
      <p>Baue neue Tests, indem du dich durch die App klickst. Die Leiste am rechten Rand schreibt mit.</p>
      <p className="acceptance__builder-status" role="status">
        {recording
          ? `Aufnahme${draft.paused ? ' pausiert' : ' läuft'}: «${draft.test.name}», ${steps} ${steps === 1 ? 'Schritt' : 'Schritte'}.`
          : draft
            ? `Du bearbeitest «${draft.test.name}».`
            : `${collection.length} ${collection.length === 1 ? 'Test' : 'Tests'} gespeichert.`}
      </p>
      <div className="acceptance__builder-actions">
        {recorder.panel === 'open' ? (
          !draft && (
            <button type="button" className="btn btn--primary" onClick={recorder.startCreating}>
              Neuen Test aufbauen
            </button>
          )
        ) : (
          <button type="button" className="btn btn--primary" onClick={recorder.expand}>
            Leiste rechts öffnen
          </button>
        )}
        <button type="button" className="btn" onClick={onCopy}>
          Ergebnis kopieren
        </button>
      </div>
      {copied ? <span className="acceptance__copied">Kopiert, jetzt im Chat einfügen</span> : <span className="acceptance__hint">Kopiert die Abnahme und alle neuen Tests als einen Text für den Chat mit Claude.</span>}
    </div>
  );
}
