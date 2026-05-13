import { app, dialog, ipcMain, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { sharedState } from '../shared-state';
import { isRemoteFilesMode, uploadRemoteFile, absoluteToRelativeImagePath, buildRemoteFileOpenUrl } from '../remote-api-utils';
import { sanitizeImageFilename } from '../path-security';

function imageSubdirForFileName(safeName: string): string {
  const lower = safeName.toLowerCase();
  if (lower.startsWith('employee_')) return 'employees';
  if (lower.startsWith('employer_')) return 'employers';
  return 'branches';
}

function normalizeUploadErrorMessage(raw: string): string {
  const msg = String(raw || '').trim();
  const upper = msg.toUpperCase();
  if (upper.includes('REQUEST ENTITY TOO LARGE') || upper.includes('PAYLOAD TOO LARGE') || upper.includes('FILE_TOO_LARGE')) {
    return 'IMAGE_TOO_LARGE_FOR_SERVER_LIMIT';
  }
  return msg || 'REMOTE_UPLOAD_FAILED';
}

const MAX_IMAGE_DIMENSION = 1600;
const TARGET_UPLOAD_BYTES = 1_200_000; // ~1.2MB per image after compression

function replaceFileExt(filename: string, extWithoutDot: string): string {
  const parsed = path.parse(filename);
  return `${parsed.name}.${extWithoutDot}`;
}

function decodeBase64Image(base64Data: string): { buffer: Buffer; mimeType: string } {
  const match = String(base64Data).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return { buffer: Buffer.from(base64Data, 'base64'), mimeType: 'image/jpeg' };
  }
  return { buffer: Buffer.from(match[2], 'base64'), mimeType: match[1] || 'image/jpeg' };
}

function optimizeImageBuffer(base64Data: string): { buffer: Buffer; ext: string; changed: boolean } {
  const decoded = decodeBase64Image(base64Data);
  const originalBuffer = decoded.buffer;
  let img = nativeImage.createFromBuffer(originalBuffer);
  if (img.isEmpty()) {
    return { buffer: originalBuffer, ext: 'jpg', changed: false };
  }

  const size = img.getSize();
  const maxSide = Math.max(size.width, size.height);
  if (maxSide > MAX_IMAGE_DIMENSION) {
    const scale = MAX_IMAGE_DIMENSION / maxSide;
    img = img.resize({
      width: Math.max(1, Math.round(size.width * scale)),
      height: Math.max(1, Math.round(size.height * scale)),
      quality: 'best',
    });
  }

  let compressed = img.toJPEG(82);
  if (compressed.length > TARGET_UPLOAD_BYTES) {
    for (let q = 76; q >= 40 && compressed.length > TARGET_UPLOAD_BYTES; q -= 6) {
      compressed = img.toJPEG(q);
    }
  }

  if (compressed.length >= originalBuffer.length && maxSide <= MAX_IMAGE_DIMENSION) {
    const ext = decoded.mimeType.includes('png') ? 'png' : (decoded.mimeType.includes('webp') ? 'webp' : 'jpg');
    return { buffer: originalBuffer, ext, changed: false };
  }
  return { buffer: compressed, ext: 'jpg', changed: true };
}

export function registerFileHandlers() {
  ipcMain.handle('file:save-image', async (_event, base64Data: string, filename: string) => {
    try {
      const requestedSafeName = sanitizeImageFilename(filename);
      if (!requestedSafeName) return { success: false, error: 'INVALID_FILENAME' };
      const optimized = optimizeImageBuffer(base64Data);
      const safeName = sanitizeImageFilename(
        optimized.changed ? replaceFileExt(requestedSafeName, optimized.ext) : requestedSafeName
      );
      if (!safeName) return { success: false, error: 'INVALID_FILENAME' };
      const imageSubdir = imageSubdirForFileName(safeName);
      const relativePath = `images/${imageSubdir}/${safeName}`;
      const buffer = optimized.buffer;

      if (isRemoteFilesMode()) {
        if (!sharedState.remoteApiSession?.token) return { success: false, error: 'REMOTE_SESSION_REQUIRED' };
        const saved = await uploadRemoteFile({
          kind: 'image', relativePath, fileName: safeName, fileBuffer: buffer,
        });
        if (!saved.success) {
          return { success: false, error: normalizeUploadErrorMessage(saved.error || 'REMOTE_UPLOAD_FAILED') };
        }
        const persistedRelativePath = saved.relativePath || relativePath;
        return { success: true, path: persistedRelativePath, relativePath: persistedRelativePath, fullPath: persistedRelativePath };
      }

      const userDataPath = app.getPath('userData');
      const imagesDir = path.join(userDataPath, 'images', imageSubdir);
      if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

      const filePath = path.join(imagesDir, safeName);
      fs.writeFileSync(filePath, buffer);

      return { success: true, path: filePath, relativePath, fullPath: filePath };
    } catch (error: unknown) {
      console.error('File save error:', error);
      const rawError = error instanceof Error ? error.message : String(error);
      return { success: false, error: normalizeUploadErrorMessage(rawError) };
    }
  });

  ipcMain.handle('file:select-image', async () => {
    try {
      if (!sharedState.mainWindow) return { success: false, error: 'Main window not available' };
      const result = await dialog.showOpenDialog(sharedState.mainWindow, {
        title: 'اختر صورة الفرع',
        properties: ['openFile'],
        filters: [
          { name: 'الصور', extensions: ['jpg', 'jpeg', 'png'] },
          { name: 'جميع الملفات', extensions: ['*'] },
        ],
      });
      if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true };
      
      const filePath = result.filePaths[0];
      if (!fs.existsSync(filePath)) return { success: false, error: 'الملف المحدد غير موجود' };

      const stats = fs.statSync(filePath);
      if (stats.size > 10 * 1024 * 1024) return { success: false, error: 'حجم الصورة كبير جداً (الحد الأقصى 10 ميجابايت)' };
      
      const fileBuffer = fs.readFileSync(filePath);
      const base64 = fileBuffer.toString('base64');
      const ext = path.extname(filePath).toLowerCase().slice(1);
      const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      const base64Data = `data:${mimeType};base64,${base64}`;
      
      return { success: true, base64Data, filename: path.basename(filePath), filePath: filePath };
    } catch (error: unknown) {
      console.error('File select error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('file:get-image-url', async (_event, imagePath: string) => {
    try {
      if (!imagePath) return { success: false, error: 'No image path provided' };
      if (imagePath.startsWith('data:')) return { success: true, url: imagePath };
      if (isRemoteFilesMode() && sharedState.remoteApiSession?.token) {
        const relativePath = absoluteToRelativeImagePath(imagePath);
        return { success: true, url: buildRemoteFileOpenUrl('image', relativePath) };
      }
      if (fs.existsSync(imagePath)) {
        const fileBuffer = fs.readFileSync(imagePath);
        const base64 = fileBuffer.toString('base64');
        const ext = path.extname(imagePath).toLowerCase().slice(1);
        const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
        return { success: true, url: `data:${mimeType};base64,${base64}` };
      }
      const userDataPath = app.getPath('userData');
      const fullPath = path.join(userDataPath, imagePath);
      if (fs.existsSync(fullPath)) {
        const fileBuffer = fs.readFileSync(fullPath);
        const base64 = fileBuffer.toString('base64');
        const ext = path.extname(fullPath).toLowerCase().slice(1);
        const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
        return { success: true, url: `data:${mimeType};base64,${base64}` };
      }
      return { success: false, error: 'Image file not found' };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('file:select-document', async () => {
    try {
      if (!sharedState.mainWindow) return { success: false, error: 'No window', canceled: true };
      const result = await dialog.showOpenDialog(sharedState.mainWindow, {
        title: 'اختر مستنداً',
        properties: ['openFile'],
        filters: [
          { name: 'مستندات وصور', extensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'gif', 'webp'] },
          { name: 'PDF', extensions: ['pdf'] },
          { name: 'Word', extensions: ['doc', 'docx'] },
          { name: 'صور', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
          { name: 'جميع الملفات', extensions: ['*'] },
        ],
      });
      if (result.canceled || !result.filePaths.length) return { success: false, canceled: true };
      const filePath = result.filePaths[0];
      if (!fs.existsSync(filePath)) return { success: false, error: 'الملف غير موجود' }; 
      return { success: true, filePath };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
  console.log("File IPC loaded");
}
