import { useId, type ChangeEvent, type CSSProperties } from 'react';
import { ASPECT_RATIOS, type AspectRatioId, type AspectRatioSpec } from '../core/aspectRatio';

export interface AspectRatioPickerProps {
  value: AspectRatioId;
  onChange: (ratio: AspectRatioId) => void;
  /** Locks every option, for example while a video renders (Requirement 15.3). */
  disabled?: boolean;
}

/** Longest side of the shape preview, in CSS px. */
const SHAPE_MAX_PX = 28;

function shapeStyle(spec: AspectRatioSpec): CSSProperties {
  const longest = Math.max(spec.width, spec.height);
  return {
    width: `${Math.round((SHAPE_MAX_PX * spec.width) / longest)}px`,
    height: `${Math.round((SHAPE_MAX_PX * spec.height) / longest)}px`,
  };
}

/** "Video shape" radio group with one card per Aspect_Ratio (Requirement 8.1). */
export function AspectRatioPicker({ value, onChange, disabled = false }: AspectRatioPickerProps) {
  const name = useId();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = ASPECT_RATIOS.find((r) => r.id === event.target.value);
    if (next !== undefined) onChange(next.id);
  };

  return (
    <fieldset className="sb-ratio" disabled={disabled}>
      <legend className="sb-ratio__legend">Video shape</legend>
      <div className="sb-ratio__options">
        {ASPECT_RATIOS.map((spec) => {
          const checked = spec.id === value;
          return (
            <label
              key={spec.id}
              className={checked ? 'sb-ratio__option sb-ratio__option--checked' : 'sb-ratio__option'}
              data-ratio={spec.id}
            >
              <input
                type="radio"
                className="sb-ratio__input sb-visually-hidden"
                name={name}
                value={spec.id}
                checked={checked}
                onChange={handleChange}
              />
              <span className="sb-ratio__shape" style={shapeStyle(spec)} aria-hidden="true" />
              <span className="sb-ratio__text">
                <span className="sb-ratio__label">{spec.label}</span>{' '}
                <span className="sb-ratio__hint">{spec.hint}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default AspectRatioPicker;
