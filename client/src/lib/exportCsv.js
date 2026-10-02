// Client-side CSV export: quote/escape values, add UTF-8 BOM so Excel
// renders Filipino characters correctly, and trigger a browser download.

const escapeCell = (value) => {
  if (value === null || value === undefined) return '';
  const str = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * @param {string} filename - e.g. 'greenplace-users.csv' (.csv appended if missing)
 * @param {string[]} headers - column labels
 * @param {Array<Array<any>>} rows - one array per row, aligned to headers
 */
export function exportToCsv(filename, headers, rows) {
  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ];
  const csv = `\uFEFF${lines.join('\r\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Timestamped export name: greenplace-users-2026-10-01.csv
 */
export function csvFilename(base) {
  const date = new Date().toISOString().slice(0, 10);
  return `${base}-${date}.csv`;
}

export default exportToCsv;
