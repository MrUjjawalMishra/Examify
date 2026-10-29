export interface RosterRow {
  name: string;
  className: string;
  section: string;
  rollNumber: string;
}
function csv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n" || c === "\r")) {
      row.push(field);
      field = "";
      if (c !== ",") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else field += c;
  }
  if (quoted) throw Error("Unclosed quote in CSV");
  row.push(field);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export async function parseRoster(file: File): Promise<RosterRow[]> {
  if (file.size > 5 * 1024 * 1024)
    throw Error("The roster must be no larger than 5 MB.");
  let rows: string[][];
  if (file.name.toLowerCase().endsWith(".csv")) rows = csv(await file.text());
  else if (file.name.toLowerCase().endsWith(".xlsx")) {
    const { Workbook } = await import("exceljs");
    const workbook = new Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount > 301)
      throw Error("Use one header and up to 300 student rows.");
    rows = [];
    sheet.eachRow((row) => {
      rows.push([1, 2, 3, 4].map((i) => row.getCell(i).text));
    });
  } else throw Error("Choose a CSV or XLSX file.");
  if (rows.length < 2 || rows.length > 301)
    throw Error("Use one header and up to 300 student rows.");
  const headers = rows.shift()!.map((s) =>
    s
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase()
      .replace(/[ _-]/g, ""),
  );
  const indices = ["studentname", "class", "section", "rollnumber"].map((h) =>
    headers.indexOf(h),
  );
  if (indices.some((i) => i < 0))
    throw Error("Headers: Student Name, Class, Section, Roll Number.");
  const result = rows.map((r) => ({
    name: r[indices[0]]?.trim() ?? "",
    className: r[indices[1]]?.trim() ?? "",
    section: r[indices[2]]?.trim() ?? "",
    rollNumber: r[indices[3]]?.trim() ?? "",
  }));
  if (
    result.some(
      (r) =>
        !r.name || !r.className || !r.section || !/^\d+$/.test(r.rollNumber),
    )
  )
    throw Error(
      "Every row needs a name, class, section and numeric roll number.",
    );
  const roman = [
    "i",
    "ii",
    "iii",
    "iv",
    "v",
    "vi",
    "vii",
    "viii",
    "ix",
    "x",
    "xi",
    "xii",
  ];
  const seen = new Set<string>();
  for (const r of result) {
    let c = r.className.toLowerCase().replace(/^class\s+/, "");
    c = roman.includes(c)
      ? String(roman.indexOf(c) + 1)
      : c.replace(/(st|nd|rd|th)$/, "");
    if (
      !/^\d+$/.test(c) ||
      Number(c) < 1 ||
      Number(c) > 12 ||
      !/^[a-z]{1,3}$/i.test(r.section) ||
      Number(r.rollNumber) < 1 ||
      Number(r.rollNumber) > 9999 ||
      r.name.length > 120
    )
      throw Error("Invalid class, section, roll number or name.");
    r.className = String(Number(c));
    r.section = r.section.toLowerCase();
    r.rollNumber = String(Number(r.rollNumber));
    r.name = r.name.normalize("NFKC");
    const k = `${r.className}/${r.section}/${r.rollNumber}`;
    if (seen.has(k)) throw Error(`Duplicate enrollment: ${r.name}`);
    seen.add(k);
  }
  return result;
}
