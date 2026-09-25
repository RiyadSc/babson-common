import { it, expect } from 'vitest';
import sharp from 'sharp';
import { preparePoster, prepareScreenshot } from '../src/lib/attachments';
it('rejects HTML disguised as a screenshot', async () => {
  await expect(
    prepareScreenshot(new File(['<script>alert(1)</script>'], 'fake.png', { type: 'image/png' })),
  ).rejects.toThrow();
});
it('re-encodes images as passive WebP', async () => {
  const input = await sharp({
    create: { width: 10, height: 10, channels: 3, background: '#aabbcc' },
  })
    .png()
    .toBuffer();
  const file = new File([new Uint8Array(input)], 'poster.png', { type: 'image/png' });
  const output = await prepareScreenshot(file);
  expect((await sharp(output).metadata()).format).toBe('webp');
});
it('sanitizes an uploaded event poster as WebP', async () => {
  const input = await sharp({
    create: { width: 1200, height: 1800, channels: 3, background: '#006b45' },
  })
    .jpeg()
    .toBuffer();
  const output = await preparePoster(
    new File([new Uint8Array(input)], 'club-poster.jpg', { type: 'image/jpeg' }),
  );
  const metadata = await sharp(output).metadata();
  expect(metadata.format).toBe('webp');
  expect(metadata.width).toBeLessThanOrEqual(1600);
  expect(metadata.height).toBeLessThanOrEqual(2000);
});
