/**
 * Saves text as a file in the browser. `toCsv` already writes the byte-order mark Excel needs for Thai, so the caller
 * passes the whole text and the type.
 */
export function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Safari needs the URL to outlive the click by a moment.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
