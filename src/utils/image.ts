// Downscales an uploaded image to a square data URI, matching the original
// app's upload pipeline (center-crop to square, capped raster size).
export function readImageFile(file: File, size = 256, maxBytes = 4 * 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file selected.'));
    if (!/^image\//.test(file.type)) return reject(new Error("That file isn't an image."));
    if (file.size > maxBytes) return reject(new Error(`Image is larger than ${Math.round(maxBytes / (1024 * 1024))} MB — try a smaller one.`));

    if (file.type === 'image/svg+xml' && file.size <= 64 * 1024) {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read that file.'));
      reader.onload = () => resolve(`data:image/svg+xml,${encodeURIComponent(String(reader.result))}`);
      reader.readAsText(file);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That image could not be decoded.'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(String(reader.result)); return; }
          const scale = Math.max(size / img.width, size / img.height);
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          ctx.drawImage(img, 0, 0, img.width, img.height, (size - w) / 2, (size - h) / 2, w, h);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          reject(new Error('Could not process that image.'));
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
