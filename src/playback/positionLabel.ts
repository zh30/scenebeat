/** Formats the Player position as "current / total" (Requirement 5.13). */
export function formatPosition(index: number, total: number): string {
  return `${index + 1} / ${total}`;
}
