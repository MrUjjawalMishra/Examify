import { expect, it } from "vitest";
import { parseRoster } from "../../web/src/roster";
import ExcelJS from "../../web/node_modules/exceljs";
it("parses a 30-student CSV preview and normalizes classroom values", async () => {
  const csv =
    "Student Name,Class,Section,Roll Number\n" +
    Array.from({ length: 30 }, (_, i) => `"Test, Student",IX,B,${i + 1}`).join(
      "\n",
    );
  const rows = await parseRoster(new File([csv], "roster.csv"));
  expect(rows).toHaveLength(30);
  expect(rows[0]).toEqual({
    name: "Test, Student",
    className: "9",
    section: "b",
    rollNumber: "1",
  });
});
it("rejects duplicate normalized enrollments before provisioning", async () => {
  await expect(
    parseRoster(
      new File(
        ["Student Name,Class,Section,Roll Number\nA,IX,B,01\nB,9,b,1"],
        "roster.csv",
      ),
    ),
  ).rejects.toThrow("Duplicate enrollment");
});
it("parses an actual XLSX workbook", async () => {
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet("Students");
  sheet.addRow(["Student Name", "Class", "Section", "Roll Number"]);
  sheet.addRow(["Ujjwal Mishra", 9, "B", 15]);
  const bytes = await book.xlsx.writeBuffer();
  const rows = await parseRoster(
    new File([new Uint8Array(bytes)], "roster.xlsx"),
  );
  expect(rows[0].rollNumber).toBe("15");
});
