import { useId, type ChangeEvent } from 'react';

export interface TranscriptInputProps {
  value: string;
  onChange: (value: string) => void;
  onLoadSample: () => void;
  onClear: () => void;
}

export function TranscriptInput({ value, onChange, onLoadSample, onClear }: TranscriptInputProps) {
  const textareaId = useId();
  const hintId = useId();

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="sb-transcript">
      <label className="sb-visually-hidden" htmlFor={textareaId}>
        Transcript
      </label>
      <textarea
        id={textareaId}
        className="sb-transcript__textarea"
        value={value}
        onChange={handleChange}
        aria-describedby={hintId}
        spellCheck={false}
        placeholder="Paste your podcast or video transcript here. Chinese and English both work."
      />
      <div className="sb-transcript__footer">
        <p className="sb-transcript__hint" id={hintId}>
          Each sentence becomes one scene. The preview updates as you type.
        </p>
        <div className="sb-transcript__actions">
          <button type="button" className="sb-button sb-button--ghost" onClick={onClear} disabled={value.length === 0}>
            Clear
          </button>
          <button type="button" className="sb-button sb-button--soft" onClick={onLoadSample}>
            Load sample
          </button>
        </div>
      </div>
    </div>
  );
}

export default TranscriptInput;
