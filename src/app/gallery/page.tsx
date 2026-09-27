"use client";

import { useState } from "react";
import ZoomableImage from "@/components/ui/ZoomableImage";
import { galleryCategories as categories, galleryData } from "@/data/gallery";

const PAGE_SIZE = 12;

export default function Gallery() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredGallery = activeCategory === "All" 
    ? galleryData 
    : galleryData.filter(item => item.category === activeCategory);
  const pageCount = Math.max(1, Math.ceil(filteredGallery.length / PAGE_SIZE));
  const visibleGallery = filteredGallery.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="pt-32 pb-24 w-full flex flex-col items-center min-h-screen">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        
        {/* Header */}
        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <h1 className="text-4xl md:text-6xl font-heading font-bold text-primary uppercase tracking-wider mb-6">
            Ink Gallery
          </h1>
          <p className="text-secondary font-light max-w-2xl mx-auto">
            A curated collection of our finest traditional handpoke and modern machine work.
          </p>
        </div>

        {/* Filter */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setCurrentPage(1); }}
              className={`px-6 py-2 rounded-full font-heading tracking-widest uppercase text-xs transition-all duration-300 border ${
                activeCategory === cat 
                  ? "bg-accent border-accent text-white" 
                  : "bg-surface border-surface text-secondary hover:bg-[#2a1b14] hover:border-[#2a1b14] hover:text-primary"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 auto-rows-[200px] md:auto-rows-[280px]">
          {visibleGallery.map((item, index) => (
            <div 
              key={item.id} 
              className={`relative overflow-hidden group cursor-pointer rounded-sm border border-border/30
                ${item.span === "tall" ? "row-span-2" : "row-span-1"}
              `}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Image */}
              <ZoomableImage 
                src={item.src} 
                alt={item.title}
                zoomTitle={item.title}
                zoomItems={visibleGallery.map((galleryItem) => ({ src: galleryItem.src, alt: galleryItem.title, title: galleryItem.title }))}
                zoomIndex={index}
                useNativeImg
                className="w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-110 group-hover:brightness-110"
              />

              {/* Hover Overlay — cinematic reveal */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none">
                {/* Dark gradient from bottom */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                
                {/* Accent line that slides in */}
                <div className="absolute bottom-0 left-0 w-0 group-hover:w-full h-[2px] bg-accent transition-all duration-700 ease-out" />
                
                {/* Category badge */}
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 translate-y-4 group-hover:translate-y-0 transition-transform duration-500 ease-out">
                  <span className="inline-block px-3 py-1 bg-accent/90 text-white font-heading tracking-widest uppercase text-[10px] md:text-xs font-bold rounded-sm backdrop-blur-sm">
                    {item.title}
                  </span>
                </div>

              </div>
            </div>
          ))}
        </div>

        {pageCount > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-4" aria-label="Gallery pages">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="border border-surface bg-surface px-4 py-2 text-xs font-semibold uppercase tracking-widest text-secondary transition-colors hover:border-[#2a1b14] hover:bg-[#2a1b14] hover:text-primary disabled:cursor-not-allowed disabled:border-zinc-900 disabled:bg-zinc-900 disabled:text-zinc-500"
            >
              Previous
            </button>
            <span className="text-sm text-secondary">Page {currentPage} of {pageCount}</span>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
              disabled={currentPage === pageCount}
              className="border border-surface bg-surface px-4 py-2 text-xs font-semibold uppercase tracking-widest text-secondary transition-colors hover:border-[#2a1b14] hover:bg-[#2a1b14] hover:text-primary disabled:cursor-not-allowed disabled:border-zinc-900 disabled:bg-zinc-900 disabled:text-zinc-500"
            >
              Next
            </button>
          </nav>
        )}

      </div>
    </div>
  );
}
