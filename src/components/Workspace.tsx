import React, { useState, useRef, useEffect } from 'react';
import { ProcessedImage, Box } from '../types';

interface WorkspaceProps {
  image: ProcessedImage;
  onUpdateImage: (updated: ProcessedImage) => void;
}

type DragAction = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | 'create';

export const Workspace: React.FC<WorkspaceProps> = ({ image, onUpdateImage }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{
    action: DragAction;
    boxId: string | null;
    startX: number;
    startY: number;
    initialBox?: Box;
  } | null>(null);
  
  const [containerScale, setContainerScale] = useState({ scale: 1, offsetX: 0, offsetY: 0 });

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current && imgRef.current) {
        const cWidth = containerRef.current.clientWidth;
        const cHeight = containerRef.current.clientHeight;
        const iWidth = image.width;
        const iHeight = image.height;
        
        const scale = Math.min((cWidth - 40) / iWidth, (cHeight - 40) / iHeight);
        const displayW = iWidth * scale;
        const displayH = iHeight * scale;
        
        setContainerScale({
          scale,
          offsetX: (cWidth - displayW) / 2,
          offsetY: (cHeight - displayH) / 2
        });
      }
    };
    
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [image]);

  const screenToImage = (sx: number, sy: number) => {
    return {
      x: (sx - containerScale.offsetX) / containerScale.scale,
      y: (sy - containerScale.offsetY) / containerScale.scale
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const imgCoords = screenToImage(x, y);

    // Check if clicked on a handle or box
    const target = e.target as HTMLElement;
    if (target.dataset.action && target.dataset.boxId) {
      const box = image.boxes.find(b => b.id === target.dataset.boxId);
      setDragState({
        action: target.dataset.action as DragAction,
        boxId: target.dataset.boxId,
        startX: imgCoords.x,
        startY: imgCoords.y,
        initialBox: box ? { ...box } : undefined
      });
      setActiveBoxId(target.dataset.boxId);
      e.stopPropagation();
      // capture pointer
      target.setPointerCapture(e.pointerId);
      return;
    }

    // Otherwise start creating a new box
    const newBox: Box = {
      id: Math.random().toString(36).substr(2, 9),
      x: imgCoords.x,
      y: imgCoords.y,
      width: 0,
      height: 0
    };
    
    onUpdateImage({
      ...image,
      boxes: [...image.boxes, newBox]
    });
    setActiveBoxId(newBox.id);
    
    setDragState({
      action: 'create',
      boxId: newBox.id,
      startX: imgCoords.x,
      startY: imgCoords.y,
      initialBox: { ...newBox }
    });
    
    containerRef.current.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState || !dragState.initialBox || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const imgCoords = screenToImage(x, y);
    
    const dx = imgCoords.x - dragState.startX;
    const dy = imgCoords.y - dragState.startY;
    
    const init = dragState.initialBox;
    let newBox = { ...init };

    switch (dragState.action) {
      case 'move':
        newBox.x = init.x + dx;
        newBox.y = init.y + dy;
        break;
      case 'nw':
        newBox.x = init.x + dx;
        newBox.y = init.y + dy;
        newBox.width = init.width - dx;
        newBox.height = init.height - dy;
        break;
      case 'se':
        newBox.width = init.width + dx;
        newBox.height = init.height + dy;
        break;
      case 'ne':
        newBox.y = init.y + dy;
        newBox.width = init.width + dx;
        newBox.height = init.height - dy;
        break;
      case 'sw':
        newBox.x = init.x + dx;
        newBox.width = init.width - dx;
        newBox.height = init.height + dy;
        break;
      case 'n':
        newBox.y = init.y + dy;
        newBox.height = init.height - dy;
        break;
      case 's':
        newBox.height = init.height + dy;
        break;
      case 'e':
        newBox.width = init.width + dx;
        break;
      case 'w':
        newBox.x = init.x + dx;
        newBox.width = init.width - dx;
        break;
      case 'create':
        newBox.x = Math.min(init.x, imgCoords.x);
        newBox.y = Math.min(init.y, imgCoords.y);
        newBox.width = Math.abs(imgCoords.x - init.x);
        newBox.height = Math.abs(imgCoords.y - init.y);
        break;
    }

    // Fix negative dimensions just in case
    if (newBox.width < 0) {
      newBox.x += newBox.width;
      newBox.width = Math.abs(newBox.width);
    }
    if (newBox.height < 0) {
      newBox.y += newBox.height;
      newBox.height = Math.abs(newBox.height);
    }
    
    // Bounds check
    newBox.x = Math.max(0, Math.min(newBox.x, image.width));
    newBox.y = Math.max(0, Math.min(newBox.y, image.height));
    newBox.width = Math.max(0, Math.min(newBox.width, image.width - newBox.x));
    newBox.height = Math.max(0, Math.min(newBox.height, image.height - newBox.y));

    onUpdateImage({
      ...image,
      boxes: image.boxes.map(b => b.id === dragState.boxId ? newBox : b)
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragState) {
      const box = image.boxes.find(b => b.id === dragState.boxId);
      // Remove tiny boxes (likely accidents)
      if (box && (box.width < 10 || box.height < 10)) {
        onUpdateImage({
          ...image,
          boxes: image.boxes.filter(b => b.id !== dragState.boxId)
        });
      }
      setDragState(null);
      const target = e.target as HTMLElement;
      if (target.hasPointerCapture(e.pointerId)) {
         target.releasePointerCapture(e.pointerId);
      }
    }
  };

  return (
    <section className="flex-1 bg-[#0f0f0f] relative flex flex-col shrink-0 min-w-0">
      <div className="h-12 bg-[#1e1e1e]/80 border-b border-white/5 flex items-center justify-between px-4 shrink-0">
        <div className="flex gap-2 items-center text-xs font-mono text-gray-400">
          <span>{image.file.name}</span>
          <div className="h-4 w-px bg-white/10 mx-2"></div>
          <span>{image.width} x {image.height} px</span>
        </div>
        <div className="text-[10px] text-gray-500 tracking-widest uppercase font-semibold">
          Drag to create • Edge to resize • Center to move
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="flex-1 relative cursor-crosshair overflow-hidden touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div 
          className="absolute shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-[#0f0f0f] border border-white/10"
          style={{
            left: containerScale.offsetX,
            top: containerScale.offsetY,
            width: image.width * containerScale.scale,
            height: image.height * containerScale.scale,
            backgroundImage: `url(${image.dataUrl})`,
            backgroundSize: '100% 100%'
          }}
        >
          <img 
            ref={imgRef}
            src={image.dataUrl} 
            alt="Workspace" 
            className="w-full h-full opacity-0 pointer-events-none" 
          />
          
          {image.boxes.map((box, idx) => {
            const isActive = activeBoxId === box.id;
            return (
              <div 
                key={box.id}
                className={`absolute border-2 ${isActive ? 'border-red-500 shadow-[0_0_10px_rgba(255,0,0,0.5)] ring-1 ring-white' : 'border-red-500/70'}`}
                style={{
                  left: box.x * containerScale.scale,
                  top: box.y * containerScale.scale,
                  width: box.width * containerScale.scale,
                  height: box.height * containerScale.scale,
                }}
                onPointerDown={(e) => {
                  setActiveBoxId(box.id);
                  e.stopPropagation();
                }}
              >
                {/* Number tag */}
                <div className={`absolute -top-6 left-0 ${isActive ? 'bg-red-600' : 'bg-red-600/70'} text-white text-[10px] font-bold px-2 py-0.5 whitespace-nowrap z-10 pointer-events-none`}>
                  Photo {(idx + 1).toString().padStart(2, '0')}
                </div>
                
                {/* Move Handle (Entire box body except borders) */}
                <div 
                  className={`absolute inset-0 cursor-move ${isActive ? 'bg-red-500/10' : ''}`}
                  data-action="move"
                  data-box-id={box.id}
                />

                {isActive && (
                  <>
                    <div className="absolute top-0 left-0 w-3 h-3 bg-red-500 border border-white -ml-1.5 -mt-1.5 cursor-nw-resize" data-action="nw" data-box-id={box.id} />
                    <div className="absolute top-0 left-1/2 w-3 h-3 bg-red-500 border border-white -ml-1.5 -mt-1.5 cursor-n-resize" data-action="n" data-box-id={box.id} />
                    <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 border border-white -mr-1.5 -mt-1.5 cursor-ne-resize" data-action="ne" data-box-id={box.id} />
                    <div className="absolute top-1/2 right-0 w-3 h-3 bg-red-500 border border-white -mr-1.5 -mt-1.5 cursor-e-resize" data-action="e" data-box-id={box.id} />
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-red-500 border border-white -mr-1.5 -mb-1.5 cursor-se-resize" data-action="se" data-box-id={box.id} />
                    <div className="absolute bottom-0 left-1/2 w-3 h-3 bg-red-500 border border-white -ml-1.5 -mb-1.5 cursor-s-resize" data-action="s" data-box-id={box.id} />
                    <div className="absolute bottom-0 left-0 w-3 h-3 bg-red-500 border border-white -ml-1.5 -mb-1.5 cursor-sw-resize" data-action="sw" data-box-id={box.id} />
                    <div className="absolute top-1/2 left-0 w-3 h-3 bg-red-500 border border-white -ml-1.5 -mt-1.5 cursor-w-resize" data-action="w" data-box-id={box.id} />
                    
                    {/* Delete button */}
                    <button
                      className="absolute -top-8 right-0 bg-[#2d2d2d] border border-white/10 hover:bg-red-900/40 text-red-400 text-[10px] font-bold px-2 py-1 rounded shadow cursor-pointer z-20 pointer-events-auto transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateImage({
                          ...image,
                          boxes: image.boxes.filter(b => b.id !== box.id)
                        });
                      }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
