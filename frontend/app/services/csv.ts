/**
 * Generates a CSV from the provided headers and rows and triggers a browser download using the given filename.
 *
 * The CSV uses CRLF ("\r\n") line endings and includes a UTF-8 BOM. Null or undefined cells are written as empty strings; cells containing quotes, commas, or newlines are quoted and internal quotes are doubled.
 *
 * @param filename - Download filename (include extension, e.g., "export.csv")
 * @param headers - Array of header values for the first CSV row
 * @param rows - Array of data rows; each row is an array of cell values (string | number | null | undefined)
 */
export function downloadCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escapeCell = (cell: string | number | null | undefined) => {
    if (cell === null || cell === undefined) return '';
    const s = String(cell);
    if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','));
  }
  const bom = '\uFEFF';
  const content = bom + lines.join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


