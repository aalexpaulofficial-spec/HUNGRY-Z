export function originallyRequestedQuantity(
  itemName: string,
  requested: Record<string, number>,
  facultyMessage: string,
  quotedQuantity: number,
): number | undefined {
  const stored = requested[itemName] ?? Object.entries(requested).find(([name]) => name.toLocaleLowerCase() === itemName.toLocaleLowerCase())?.[1];
  if (Number.isFinite(stored) && stored >= 0) return stored;

  const fromMessage = quantityFromFacultyMessage(itemName, facultyMessage);
  if (fromMessage !== undefined) return fromMessage;

  // Manual quotations have no menu-keyed food_requirements entry. Keep the
  // quantity visible for older messages that do not specify it explicitly.
  return Number.isFinite(quotedQuantity) && quotedQuantity >= 0 ? quotedQuantity : undefined;
}

function quantityFromFacultyMessage(itemName: string, facultyMessage: string): number | undefined {
  const normalizedName = itemName.trim().replace(/\s+/g, " ");
  if (!normalizedName || !facultyMessage.trim()) return undefined;
  const escapedName = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const itemMatch = new RegExp(escapedName, "i").exec(facultyMessage);
  if (!itemMatch || itemMatch.index === undefined) return undefined;

  const beforeItem = facultyMessage.slice(Math.max(0, itemMatch.index - 48), itemMatch.index);
  const afterItem = facultyMessage.slice(itemMatch.index + itemMatch[0].length, itemMatch.index + itemMatch[0].length + 24);
  const beforeQuantity = beforeItem.match(/\b([1-9]\d{0,5})\s*x?(?:\s+[a-z][\w&'/-]*){0,3}\s*$/i);
  const afterQuantity = afterItem.match(/^[\s(:=-]*x?\s*([1-9]\d{0,5})\b/i);
  const value = beforeQuantity?.[1] ?? afterQuantity?.[1];
  return value ? Number(value) : undefined;
}
