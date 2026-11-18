const toPdfAscii = (value: unknown) => String(value ?? "").replace(/?/g, "INR ").replace(/×/g, "x").replace(/[–—]/g, "-").replace(/·/g, "|").replace(/[^\x20-\x7E]/g, "?");

const escapePdf = (value: string) => value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

export function buildSimplePdf(lines: string[]) {
  const wrapped = lines.flatMap((line) => {
    const safe = toPdfAscii(line);
    if (!safe) return [""];
    const result: string[] = [];
    for (let offset = 0; offset < safe.length; offset += 92) result.push(safe.slice(offset, offset + 92));
    return result;
  });
  const pages: string[][] = [];
  for (let offset = 0; offset < wrapped.length; offset += 50) pages.push(wrapped.slice(offset, offset + 50));
  if (!pages.length) pages.push(["HUNGRY Z report"]);

  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  pages.forEach((page, index) => {
    const pageId = 4 + index * 2;
    const contentId = pageId + 1;
    const commands = ["BT", "/F1 10 Tf", "48 796 Td", "14 TL"];
    page.forEach((line, lineIndex) => {
      if (lineIndex === 0 && index === 0) commands.push("/F1 16 Tf");
      else if (lineIndex === 1 && index === 0) commands.push("/F1 10 Tf");
      commands.push(`(${escapePdf(line)}) Tj`, "T*");
    });
    commands.push("ET");
    const stream = commands.join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}