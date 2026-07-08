export function searchTerms(query: string): string[] {
  const suffixes = [
    "에서",
    "했던",
    "하던",
    "이었던",
    "였던",
    "이었",
    "였",
    "하는",
    "한",
    "을",
    "를",
    "이",
    "가",
    "은",
    "는",
    "의",
    "에",
    "와",
    "과",
    "도"
  ];
  const terms = new Set<string>();
  for (const rawTerm of query.trim().toLowerCase().split(/\s+/).filter(Boolean)) {
    terms.add(rawTerm);
    for (const suffix of suffixes) {
      if (rawTerm.length > suffix.length + 1 && rawTerm.endsWith(suffix)) {
        terms.add(rawTerm.slice(0, -suffix.length));
      }
    }
  }
  return [...terms];
}
