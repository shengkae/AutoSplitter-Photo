import React, { useEffect, useRef } from 'react';
import { ProcessedImage } from '../types';

interface SidebarProps {
  images: ProcessedImage[];
  activeImageId: string | null;
  onSelectImage: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ images, activeImageId, onSelectImage }) => {
  return (
    <aside className="w-60 bg-[#181818] border-r border-white/10 flex flex-col shrink-0 h-full overflow-hidden z-10">
      <div className="p-3 border-b border-white/5 shrink-0">
        <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Review Batch Detection</h2>
        <p className="text-[11px] text-gray-400 mt-1">{images.length} files processed</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {images.map(img => {
          const isActive = activeImageId === img.id;
          return (
            <div 
              key={img.id}
              onClick={() => onSelectImage(img.id)}
              className={`relative p-1 rounded cursor-pointer border transition-all ${
                isActive 
                  ? 'bg-blue-600/10 border-blue-500/50' 
                  : 'bg-[#242424] border-white/5 hover:border-white/20'
              }`}
            >
              <div className="aspect-[4/3] relative rounded overflow-hidden">
                <img 
                  src={img.dataUrl} 
                  alt={img.file.name}
                  className={`w-full h-full object-cover rounded ${isActive ? 'opacity-80' : 'grayscale'}`}
                />
                {isActive && <div className="absolute top-1 right-1 bg-blue-600 text-[10px] px-1 rounded z-10 text-white font-medium">Active</div>}
                <ThumbnailBoxes image={img} isActive={isActive} />
              </div>
              <p className="text-[10px] mt-1 text-gray-300 truncate">{img.file.name}</p>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

const ThumbnailBoxes: React.FC<{ image: ProcessedImage, isActive?: boolean }> = ({ image, isActive }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none p-1">
      <div className="relative w-full h-full">
      {image.boxes.map(box => {
        // Calculate percentages for positioning
        const left = (box.x / image.width) * 100;
        const top = (box.y / image.height) * 100;
        const width = (box.width / image.width) * 100;
        const height = (box.height / image.height) * 100;

        return (
          <div 
            key={box.id}
            className={`absolute border ${isActive ? 'border-red-500' : 'border-red-500/40'}`}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${width}%`,
              height: `${height}%`
            }}
          />
        );
      })}
      </div>
    </div>
  );
};
