/** Readable login identifiers are tenant-scoped; never use them as database IDs. */
function nameParts(name: string): string[] {
  const parts = name.normalize('NFKC').toLocaleLowerCase('en-IN').trim()
    .replace(/[^\p{L}\p{M}\p{N}\s.-]/gu, '').split(/[\s.-]+/u).filter(Boolean);
  if (!parts.length || parts.join('.').length > 100) throw new Error('INVALID_NAME');
  return parts;
}

export function normalizeClass(value: string): string {
  const normalized = value.normalize('NFKC').trim().toLowerCase().replace(/^class\s+/, '');
  const roman = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'];
  const index = roman.indexOf(normalized);
  if (index !== -1) return String(index + 1);
  if (!/^\d{1,2}(st|nd|rd|th)?$/.test(normalized)) throw new Error('INVALID_CLASS');
  const number = Number.parseInt(normalized, 10);
  if (number < 1 || number > 12) throw new Error('INVALID_CLASS');
  return String(number);
}

export function studentCredentials(input: { name: string; className: string; section: string; rollNumber: string }) {
  const parts = nameParts(input.name);
  const className = normalizeClass(input.className);
  const section = input.section.normalize('NFKC').trim().toLowerCase().replace(/^section\s+/, '');
  if (!/^[a-z]{1,3}$/.test(section)) throw new Error('INVALID_SECTION');
  const roll = input.rollNumber.normalize('NFKC').trim();
  if (!/^\d{1,6}$/.test(roll) || Number(roll) < 1) throw new Error('INVALID_ROLL_NUMBER');
  const rollNumber = String(Number(roll));
  const suffix = `${className}${section}${rollNumber}`;
  return { username: `${parts.join('.')}.${suffix}`, initialPassword: `${parts[0]}.${suffix}`,
    className, section, rollNumber };
}

export function teacherUsername(name: string): string {
  return `t-${nameParts(name).join('.')}`;
}

/** Preview only: commit must also enforce a tenant-local unique constraint. */
export function resolveUsername(base: string, occupied: ReadonlySet<string>): string {
  if (!occupied.has(base)) return base;
  for (let suffix = 2; suffix <= 10000; suffix++) {
    const candidate = `${base}-${suffix}`;
    if (!occupied.has(candidate)) return candidate;
  }
  throw new Error('USERNAME_COLLISION_LIMIT');
}
