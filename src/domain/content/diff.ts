/** Word-level diff for showing a proposed copy change against the live copy. */

export interface DiffSegment {
  readonly type: "same" | "added" | "removed";
  readonly text: string;
}

const tokenize = (text: string) => text.match(/\s+|[^\s]+/g) ?? [];

export function diffWords(before: string, after: string): DiffSegment[] {
  const a = tokenize(before);
  const b = tokenize(after);
  // Longest-common-subsequence table; copy fields are short (≤ 200 characters).
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      const row = lcs[i] ?? [];
      row[j] =
        a[i] === b[j]
          ? (lcs[i + 1]?.[j + 1] ?? 0) + 1
          : Math.max(lcs[i + 1]?.[j] ?? 0, row[j + 1] ?? 0);
    }
  }

  const segments: DiffSegment[] = [];
  const push = (type: DiffSegment["type"], text: string) => {
    const last = segments.at(-1);
    if (last && last.type === type)
      segments[segments.length - 1] = { type, text: last.text + text };
    else segments.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i] ?? "");
      i += 1;
      j += 1;
    } else if ((lcs[i + 1]?.[j] ?? 0) >= (lcs[i]?.[j + 1] ?? 0)) {
      push("removed", a[i] ?? "");
      i += 1;
    } else {
      push("added", b[j] ?? "");
      j += 1;
    }
  }
  while (i < a.length) push("removed", a[i++] ?? "");
  while (j < b.length) push("added", b[j++] ?? "");
  return segments;
}
