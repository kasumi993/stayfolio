/**
 * Picking photos and files. One place for every native picker, so screens
 * only deal with `{ bytes, mime, name }`.
 */
import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { base64ToBytes } from './bytes';
import { readFile } from './readFile';

export interface PickedFile {
  bytes: Uint8Array;
  mime: string;
  name: string;
  /** Present for images: handy for previews and for the receipt reader. */
  base64?: string;
}

/** Receipts are shrunk before upload: sharp enough to read, light to store. */
const MAX_WIDTH = 1500;
const QUALITY = 0.7;

async function shrink(uri: string, width: number, name: string): Promise<PickedFile> {
  const context = ImageManipulator.manipulate(uri);
  if (width > MAX_WIDTH) context.resize({ width: MAX_WIDTH });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: QUALITY, base64: true });
  const base64 = saved.base64 ?? '';
  return { bytes: base64ToBytes(base64), mime: 'image/jpeg', name: name.replace(/\.\w+$/, '') + '.jpg', base64 };
}

/** Takes a photo. Returns null when cancelled or when the camera is refused. */
export async function takePhoto(): Promise<PickedFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error('camera_denied');
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 1 });
  const asset = result.assets?.[0];
  if (result.canceled || !asset) return null;
  return shrink(asset.uri, asset.width, asset.fileName ?? 'recu');
}

/** Picks an image from the photo library. */
export async function pickPhoto(): Promise<PickedFile | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 });
  const asset = result.assets?.[0];
  if (result.canceled || !asset) return null;
  return shrink(asset.uri, asset.width, asset.fileName ?? 'recu');
}

/** Picks a PDF (or an image) from the files of the device. */
export async function pickDocument(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
    copyToCacheDirectory: true,
    base64: false,
  });
  const asset = result.assets?.[0];
  if (result.canceled || !asset) return null;
  const mime = asset.mimeType ?? (asset.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
  if (mime.startsWith('image/')) return shrink(asset.uri, MAX_WIDTH + 1, asset.name);
  return { bytes: await readFile(asset), mime, name: asset.name };
}

/** Picks an Excel workbook. */
export async function pickWorkbook(): Promise<{ bytes: Uint8Array; name: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xlsx'],
    copyToCacheDirectory: true,
    base64: false,
  });
  const asset = result.assets?.[0];
  if (result.canceled || !asset) return null;
  return { bytes: await readFile(asset), name: asset.name };
}
