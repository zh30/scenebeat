// Feature: scenebeat-mvp, Property 24: Export filename format.
// For any valid Date, formatExportFilename matches
// ^scenebeat-storyboard-\d{8}-\d{6}\.json$, and the digits equal the date's
// local year, month, day, hour, minute, and second, zero-padded.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { formatExportFilename } from '../../src/core/exportFilename';

// Four-digit local years only: the YYYYMMDD format cannot represent years
// outside 0000-9999. A one-day margin keeps the local year in range in every
// time zone.
const minDate = new Date(0);
minDate.setUTCFullYear(0, 0, 2); // Date.UTC would map year 0 to 1900
const validDate = fc.date({
  min: minDate,
  max: new Date(Date.UTC(9999, 11, 30)),
  noInvalidDate: true,
});

const pattern = /^scenebeat-storyboard-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.json$/;

describe('Property 24: Export filename format', () => {
  /** **Validates: Requirements 9.2** */
  it('matches the filename pattern and encodes local date and time', () => {
    fc.assert(
      fc.property(validDate, (d) => {
        const name = formatExportFilename(d);
        const m = pattern.exec(name);
        expect(m).not.toBeNull();
        const [, y, mo, da, h, mi, s] = m!.map(Number);
        expect(y).toBe(d.getFullYear());
        expect(mo).toBe(d.getMonth() + 1);
        expect(da).toBe(d.getDate());
        expect(h).toBe(d.getHours());
        expect(mi).toBe(d.getMinutes());
        expect(s).toBe(d.getSeconds());
      }),
      { numRuns: 200 },
    );
  });
});
