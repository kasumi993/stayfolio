/** Reads a file picked in the browser. */
export async function readFile(asset: { uri: string; file?: unknown }): Promise<Uint8Array> {
  const blob = asset.file instanceof Blob ? asset.file : await (await fetch(asset.uri)).blob();
  return new Uint8Array(await blob.arrayBuffer());
}
