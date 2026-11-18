export function isGitHubRepository(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(value) &&
    !value.includes("..") &&
    !value.endsWith("/.") &&
    !value.toLowerCase().endsWith(".git")
  );
}

export function isOptionalGitHubRepository(
  value: unknown,
): value is string | undefined {
  return value === undefined || value === "" || isGitHubRepository(value);
}
