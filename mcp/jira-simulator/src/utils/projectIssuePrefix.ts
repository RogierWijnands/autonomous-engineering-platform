export function projectIssuePrefix(projectName: string): string {
  const words = projectName.trim().split(/\s+/);
  const firstWord = normalizePrefixPart(words[0] ?? "");
  const prefix =
    firstWord.length === 1
      ? firstWord + normalizePrefixPart(words[1] ?? "").slice(0, 1)
      : firstWord;

  return prefix.slice(0, 10);
}

function normalizePrefixPart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
