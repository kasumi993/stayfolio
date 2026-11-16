/** Writes a file to the cache and opens the system share sheet (native). */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function saveFile(name: string, bytes: Uint8Array, mime: string): Promise<void> {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(bytes);
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: name });
}
