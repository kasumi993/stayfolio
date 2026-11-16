/** Reads a local file picked by the user (native). See readFile.web.ts for browsers. */
import { File } from 'expo-file-system';

export async function readFile(asset: { uri: string; file?: unknown }): Promise<Uint8Array> {
  return new File(asset.uri).bytes();
}
