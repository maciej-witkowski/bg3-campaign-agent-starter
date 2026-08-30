export function normalizePolishMatchingKey(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("pl-PL");
}
