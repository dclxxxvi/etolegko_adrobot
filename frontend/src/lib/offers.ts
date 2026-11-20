/**
 * Offer names in Keitaro often start with the offer ID ("18813 Flexacil ...").
 * The UI already shows "#id" next to the name, so the leading ID is dropped.
 */
export function offerDisplayName(id: number, name: string | null | undefined): string {
  if (!name) return 'Unknown offer'
  const stripped = name.replace(new RegExp(`^\\s*#?${id}(?!\\d)[\\s\\-–—:|.]*`), '').trim()
  return stripped || name
}
