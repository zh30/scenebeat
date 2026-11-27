import { useState } from 'react';
import { formatExportFilename } from '../core/exportFilename';
import { parseStoryboard, serializeStoryboard } from '../core/serialize';
import type { Storyboard, ValidationError } from '../core/types';
import { validateStoryboard } from '../core/validate';
import { DownloadIcon } from './icons';

export interface ExportButtonProps {
  storyboard: Storyboard;
  /** Validator run on the serialized storyboard. Injectable so tests can stub errors. */
  validate?: (value: unknown) => ValidationError[];
  /** Clock used for the download filename. Defaults to the current time. */
  now?: () => Date;
}

/** Triggers a browser download of `json` without any network request. */
function downloadJson(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}

export function ExportButton({
  storyboard,
  validate = validateStoryboard,
  now = () => new Date(),
}: ExportButtonProps) {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const disabled = storyboard.sceneCount === 0 || storyboard.scenes.length === 0;

  const handleExport = () => {
    const json = serializeStoryboard(storyboard);
    const parsed = parseStoryboard(json);
    const found: ValidationError[] = parsed.ok
      ? validate(parsed.value)
      : [{ path: '$', message: parsed.error }];

    if (found.length > 0) {
      setErrors(found);
      return;
    }
    setErrors([]);
    downloadJson(json, formatExportFilename(now()));
  };

  return (
    <div className="sb-export">
      <button
        type="button"
        className="sb-button sb-button--primary sb-button--large"
        onClick={handleExport}
        disabled={disabled}
      >
        <DownloadIcon />
        Download storyboard
      </button>
      <p className="sb-export__hint">
        {disabled
          ? 'Add some text first. There is nothing to download yet.'
          : 'Saves a .json file with every scene, its template and its timing.'}
      </p>
      {errors.length > 0 && (
        <div className="sb-export__problem" role="alert" aria-label="Export validation errors">
          <p className="sb-export__problem-title">The file was not saved because the storyboard has problems:</p>
          <ul className="sb-export__errors">
            {errors.map((error, i) => (
              <li key={`${error.path}-${i}`} className="sb-export__error">
                <span className="sb-export__error-path">{error.path}</span>: {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ExportButton;
