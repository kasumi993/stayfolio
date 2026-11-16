/** Downloads a file from the browser. */
export async function saveFile(name: string, bytes: Uint8Array, mime: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
