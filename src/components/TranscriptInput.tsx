import { useId, type ChangeEvent } from 'react';

export interface TranscriptInputProps {
  value: string;
  onChange: (value: string) => void;
  onLoadSample: () => void;
  onClear: () => void;
}

export function TranscriptInput({ value, onChange, onLoadSample, onClear }: TranscriptInputProps) {
  const textareaId = useId();

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  return (
    <section className="sb-transcript">
      <label className="sb-transcript__label" htmlFor={textareaId}>
        Transcript
      </label>
      <textarea
        id={textareaId}
        className="sb-transcript__textarea"
        value={value}
        onChange={handleChange}
        rows={12}
        spellCheck={false}
        placeholder="Paste a podcast or video transcript here…"
      />
      <div className="sb-transcript__actions">
        <button type="button" onClick={onLoadSample}>
          Load sample
        </button>
        <button type="button" onClick={onClear}>
          Clear
        </button>
      </div>
    </section>
  );
}

export default TranscriptInput;
