function formatCardEntry(c) {
  const label = c.name ?? c.id;
  const typePart = c.type ? ` [${c.type}]` : '';
  const d = c.details;
  if (!d) return `${label}${typePart}`;

  const stats = [];
  if (d.cost != null) stats.push(`${d.cost}-cost`);
  if (d.power != null) stats.push(`${d.power} power`);
  if (d.color) stats.push(d.color);
  const statsPart = stats.length > 0 ? ` (${stats.join(', ')})` : '';

  let effectPart = '';
  if (d.effect) {
    const clean = d.effect.replace(/[\x00-\x1F\x7F]/g, ' ').trim();
    const truncated = clean.length > 150 ? `${clean.slice(0, 150)}...` : clean;
    effectPart = ` - "${truncated}"`;
  }

  return `${label}${typePart}${statsPart}${effectPart}`;
}

function formatLeaderEntry(leader) {
  const label = leader.name ?? leader.id;
  const d = leader.details;
  if (!d) return `${label} (${leader.id})`;

  const tags = [d.type ?? 'Leader'];
  if (d.color) tags.push(d.color);
  const tagPart = ` [${tags.join(', ')}]`;

  let effectPart = '';
  if (d.effect) {
    const clean = d.effect.replace(/[\x00-\x1F\x7F]/g, ' ').trim();
    const truncated = clean.length > 150 ? `${clean.slice(0, 150)}...` : clean;
    effectPart = ` - "${truncated}"`;
  }

  return `${label} (${leader.id})${tagPart}${effectPart}`;
}

export function buildPrompt(summary) {
  const turnLines = summary.turns
    .filter((t) => t.isMyTurn)
    .map((t) => {
      const displayed = t.cards.slice(0, 5);
      const remainder = t.cards.length - displayed.length;
      const cardList = displayed.map(formatCardEntry).join(', ') || 'nothing recorded';
      const suffix = remainder > 0 ? `, +${remainder} more` : '';
      return `Turn ${t.turnNumber} (Mine): played ${cardList}${suffix}`;
    })
    .join('\n');

  return `You are an expert One Piece TCG coach. Analyze this game and provide coaching feedback.

My leader: ${formatLeaderEntry(summary.myLeader)}
Opponent's leader: ${formatLeaderEntry(summary.oppLeader)}

Turn-by-turn play:
${turnLines || 'No turns recorded.'}

Please provide:
1. A brief overall game assessment (2-3 sentences)
2. For each of MY turns, specific coaching: what was good, what better options might exist, and why

Format your response as JSON:
{
  "overall": "string",
  "turns": [
    { "turnNumber": N, "feedback": "string" }
  ]
}
Only include MY turns (not opponent turns) in the turns array.
Keep each feedback under 100 words. Be specific and actionable.`;
}
