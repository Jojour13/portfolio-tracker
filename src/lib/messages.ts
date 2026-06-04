// Rotating bottom-of-page lines. Profit -> humility/discipline; loss ->
// resilience/risk-awareness. Rotated by day so it doesn't flicker per render.

export const profitLines = [
  "Good outcome ≠ good decision. Grade the process, not the P/L.",
  "Profit is rented, not owned. Don't mistake a bull market for genius.",
  "Bank some. Paper gains have a way of evaporating overnight.",
  "Your edge is position sizing, not prediction. Respect it.",
  "Green screen, calm mind. Don't let it talk you into more risk.",
  "The market gave it; the market can ask for it back. Stay humble.",
  "Plan your exit while you're still smiling.",
  "Compounding rewards the patient, not the euphoric.",
  "Up 20%? Cool. Now what's your risk if you're wrong tomorrow?",
  "Winners average up with a plan, not with FOMO.",
  "Don't confuse a tailwind with talent.",
  "Greed is just fear wearing a nicer suit. Notice it.",
];

export const lossLines = [
  "Red is tuition. The only waste is not learning the lesson.",
  "Survive first. You can't compound from zero.",
  "A drawdown is feedback, not a verdict on you.",
  "Was the thesis wrong, or just early? Be honest — then act.",
  "Don't revenge-trade. The market never reads your apology.",
  "Cash is a position too. Sitting out is a valid move.",
  "Cut what's broken; keep what still makes sense.",
  "The best traders are great losers — small, fast, unemotional.",
  "Zoom out. One ugly candle isn't the whole chart.",
  "Protect the downside and the upside takes care of itself.",
  "Risk a little to learn a lot; never bet the account to be right.",
  "Bad days are inevitable. Bad risk management is a choice.",
];

/** Pick a line, rotating once per day so it feels calm, not anxious. */
export function pickMessage(isProfit: boolean, dayMs = Date.now()): string {
  const lines = isProfit ? profitLines : lossLines;
  const idx = Math.floor(dayMs / 86_400_000) % lines.length;
  return lines[idx];
}
