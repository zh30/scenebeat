import { countByTemplate } from '../core/stats';
import { TEMPLATES, type Storyboard } from '../core/types';
import { TEMPLATE_LABELS } from './templateLabels';

export interface StoryboardListProps {
  storyboard: Storyboard;
  currentIndex: number;
  onSelect: (index: number) => void;
}

/** One row per scene (Req 6.1 to 6.3) plus total and per-template counts (Req 6.4). */
export function StoryboardList({ storyboard, currentIndex, onSelect }: StoryboardListProps) {
  const counts = countByTemplate(storyboard);
  const total = storyboard.scenes.length;

  return (
    <section className="sb-list" aria-label="Storyboard">
      <div className="sb-list__summary">
        <span className="sb-list__total">
          <strong data-testid="storyboard-total">{total}</strong> {total === 1 ? 'scene' : 'scenes'}
        </span>
        <ul className="sb-list__counts">
          {TEMPLATES.map((template) => (
            <li
              key={template}
              className="sb-list__count"
              data-template={template}
              data-testid={`storyboard-count-${template}`}
            >
              <span className={`sb-dot sb-dot--${template}`} aria-hidden="true" />
              <span>{TEMPLATE_LABELS[template]}</span> <span className="sb-list__num">{counts[template]}</span>
            </li>
          ))}
        </ul>
      </div>
      {total === 0 ? (
        <p className="sb-list__empty">Scenes will be listed here, one per sentence.</p>
      ) : (
        <ol className="sb-list__rows">
          {storyboard.scenes.map((scene) => {
            const isCurrent = scene.index === currentIndex;
            return (
              <li key={scene.index}>
                <button
                  type="button"
                  className={isCurrent ? 'sb-list__row sb-list__row--current' : 'sb-list__row'}
                  aria-current={isCurrent ? 'true' : undefined}
                  data-template={scene.template}
                  onClick={() => onSelect(scene.index)}
                >
                  <span className="sb-list__index">{scene.index + 1}</span>
                  <span className="sb-list__text">{scene.text}</span>
                  <span className={`sb-badge sb-badge--${scene.template}`}>{TEMPLATE_LABELS[scene.template]}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
