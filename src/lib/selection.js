// The picker keeps what the customer ticked as { applianceId: { hoursKey, qty: { variantId: n } } }.
// The server wants a flat list of { applianceId, variantId, qty, hoursKey? }. These two convert between them.

export function selectionFromItems(items, catalog) {
  const byId = new Map(catalog.appliances.map((a) => [a.id, a]));
  const selection = {};
  for (const item of items) {
    const ap = byId.get(item.applianceId);
    if (!ap) continue;
    const entry = (selection[ap.id] ??= { hoursKey: item.hoursKey ?? ap.defaultHours, qty: {} });
    entry.qty[item.variantId] = (entry.qty[item.variantId] ?? 0) + item.qty;
  }
  return selection;
}

export function itemsFromSelection(selection, catalog) {
  const fixed = new Set(catalog.appliances.filter((a) => a.hoursMode === 'fixed').map((a) => a.id));
  const items = [];
  for (const [applianceId, entry] of Object.entries(selection)) {
    for (const [variantId, qty] of Object.entries(entry.qty)) {
      if (qty > 0) {
        items.push({ applianceId, variantId, qty, ...(fixed.has(applianceId) ? {} : { hoursKey: entry.hoursKey }) });
      }
    }
  }
  return items;
}
