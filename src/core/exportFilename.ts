function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/**
 * Formats the export filename using the date's local time:
 * `scenebeat-storyboard-YYYYMMDD-HHmmss.json`.
 */
export function formatExportFilename(d: Date): string {
  const date = `${pad(d.getFullYear(), 4)}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `scenebeat-storyboard-${date}-${time}.json`;
}
