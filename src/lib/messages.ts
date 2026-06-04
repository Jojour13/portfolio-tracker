// Rotating bottom-of-page lines. Profit -> humility/discipline; loss ->
// resilience/risk-awareness. Rotated by day so it doesn't flicker per render.

export const profitLines = [
  "Green days test discipline more than red ones.",
  "Good outcome ≠ good decision. Review the process, not the P/L.",
  "Profit is rented, not owned. Don't confuse it with skill.",
  "Take some off the table before the table takes it from you.",
  "Position size, not prediction, is why you're up. Respect it.",
  "Don't add risk just because the screen is green.",
  "Stay humble — the market gives and the market takes.",
];

export const lossLines = [
  "Red is tuition. Make sure you actually learn the lesson.",
  "Survival first. You can't compound from zero.",
  "A drawdown is data, not a verdict on you.",
  "Cut the thesis, not just the position — know why it failed.",
  "Don't revenge-trade. The market won't apologize, so don't beg.",
  "Capital preserved is optionality kept. Live to trade again.",
  "Zoom out. One red candle isn't the whole story.",
];

/** Pick a line, rotating once per day so it feels calm, not anxious. */
export function pickMessage(isProfit: boolean, dayMs = Date.now()): string {
  const lines = isProfit ? profitLines : lossLines;
  const idx = Math.floor(dayMs / 86_400_000) % lines.length;
  return lines[idx];
}
