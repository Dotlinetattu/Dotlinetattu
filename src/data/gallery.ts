export type GalleryItem = { id: string; src: string; title: string; category: 'Custom'; span: 'tall' | 'normal' };

const galleryImagePaths = [
  '/assets/Gallery/custom-balinese-ornament-lotus-crafting.webp',
  '/assets/Gallery/custom-bunga-terung-dayak-iconic-2.webp',
  '/assets/Gallery/custom-titi-mentawai-courage.webp',
  '/assets/Gallery/custom-geometric-ornament-seven-cakras.webp',
  '/assets/Gallery/custom-geometric-ornament-bamboo-shot-growth-resistance.webp',
  '/assets/Gallery/outrigger-boat-symbol-custom-titi-mentawai.webp',
  '/assets/Gallery/custom-geometric-ornament-leluhukh-social-harmony.webp',
  '/assets/Gallery/custom-motif-kebung-tikhai-harmonious-relationship.webp',
  '/assets/Gallery/custom-geometric-ornament-social-adventure.webp',
  '/assets/Gallery/custom-titi-gagai-expertise-agility.webp',
  '/assets/Gallery/outrigger-boat-symbol-custom-titi-mentawai-2.webp',
  '/assets/Gallery/custom-geometric-ornament-snake-tree-of-life.webp',
  '/assets/Gallery/custom-titi-saliou-balance-of-nature-harmony-of-life.webp',
  '/assets/Gallery/custom-geometric-ornament-rooted-hook-harmonize-2.webp',
  '/assets/Gallery/custom-geometric-ornament-rooted-hook-harmonize.webp',
  '/assets/Gallery/custom-geometric-ornament-process-of-ripening.webp',
  '/assets/Gallery/custom-geometric-ornament-melayu-scattered-stars.webp',
  '/assets/Gallery/custom-geometric-ornament-rooted-harmonies.webp',
  '/assets/Gallery/custom-geometric-ornament-lotus-flower-resilience-transformation-2.webp',
  '/assets/Gallery/custom-geometric-ornament-lotus-flower-resilience-transformation.webp',
  '/assets/Gallery/custom-geometric-ornament-lotus-flower-resilience-transformation-3.webp',
  '/assets/Gallery/custom-geometric-ornament-agile-justice-skilled.webp',
  '/assets/Gallery/custom-geometric-ornament-lotus-flower-7-elements-rebirth.webp',
  '/assets/Gallery/custom-geometric-balinese-ornament-patra-flower-2.webp',
  '/assets/Gallery/custom-geometric-ornament-agile-decisive.webp',
  '/assets/Gallery/custom-geometric-balinese-ornament-patra-flower.webp',
  '/assets/Gallery/custom-geometric-balinese-ornament-patra-flower-process-of-ripening.webp',
  '/assets/Gallery/custom-arrow-titi-mentawai-courage-2.webp',
  '/assets/Gallery/custom-arrow-titi-mentawai-courage.webp',
  '/assets/Gallery/tattoo-artist.webp',
  '/assets/Gallery/custom-geometric-ornament-monkey-mask.webp',
  '/assets/Gallery/custom-bunga-terung-dayak-iconic.webp',
] as const;

function titleFromUrl(url: string) {
  const filename = decodeURIComponent(url.split('/').pop() || '').replace(/\.[^.]+$/, '');
  return filename.replace(/^(custom-|outrigger-boat-symbol-|tattoo-artist)/, '').replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function createGalleryItems(urls: readonly string[] = galleryImagePaths): GalleryItem[] {
  return [...new Set(urls)].map((src, index) => ({ id: 'gallery-' + (index + 1), src, title: titleFromUrl(src), category: 'Custom', span: index % 5 === 0 ? 'tall' : 'normal' }));
}

export const galleryData = createGalleryItems();
export const galleryCategories = ['All', 'Custom'] as const;
