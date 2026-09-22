import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

// Pexels photo IDs, selected from public free-to-use photo pages.
const ids = [15390858,34618469,887584,17785572,16921451,30856994,26585801,13020842,12886754,33341807,35235550,13849048,29708258,8424459,29180750,8761327];
await mkdir('public/images/events', { recursive: true });
for (const id of ids) {
  const response = await fetch(`https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1200`, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Photo ${id}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  for (const width of [480,960]) {
    await sharp(bytes).rotate().resize({width,withoutEnlargement:true}).webp({quality:78}).toFile(`public/images/events/${id}-${width}.webp`);
  }
  console.log(`Saved ${id}`);
}
