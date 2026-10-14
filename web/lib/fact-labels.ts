/**
 * Fact labels on screen (S5, "Label on screen").
 *
 * One map, so the ranking reasons, the dial block and the menu all name a fact
 * the same way. This module imports nothing, so any engine module may use it.
 */

export const FACT_LABELS: Record<string, string> = {
  "cold-mornings": "cold mornings",
  "hot-afternoons": "hot afternoons",
  "cold-other": "too cold",
  "hot-other": "too hot",
  "core-zone": "core zone",
  "west-zone": "west zone",
  "east-zone": "east zone",
  repeat: "repeat",
  "opposite-fixes": "opposite fixes",
  "fit-out-12m": "renovation in the last 12 months",
  vav: "VAV box",
  fcu: "fan coil unit",
};

export function factLabel(factId: string): string {
  return FACT_LABELS[factId] ?? factId;
}
