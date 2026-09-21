import sharp from 'sharp';
export async function prepareScreenshot(file: File) {
  if (
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    file.size > 5 * 1024 * 1024 ||
    file.size === 0
  )
    throw new Error('Choose a PNG, JPEG, or WebP screenshot under 5 MB.');
  // Decode and re-encode to strip metadata and reject forged or active file formats.
  const bytes = Buffer.from(await file.arrayBuffer());
  const image = sharp(bytes, { limitInputPixels: 20_000_000 });
  const metadata = await image.metadata();
  if (!['png', 'jpeg', 'webp'].includes(metadata.format || ''))
    throw new Error('Unsupported screenshot format');
  return image
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
}
