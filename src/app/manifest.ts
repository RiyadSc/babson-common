import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Common · Babson',
    short_name: 'Common',
    description: 'Your campus, a little closer.',
    start_url: '/app',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#006b45',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
