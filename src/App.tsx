import React, { useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Save, CheckCircle, ArrowLeft } from 'lucide-react';
import { StartScreen } from './components/StartScreen';
import { Sidebar } from './components/Sidebar';
import { Workspace } from './components/Workspace';
import { ProcessedImage } from './types';
import { detectPhotos, readFileAsDataURL } from './utils/imageProcessing';

export default function App() {
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFilesSelected = async (files: File[]) => {
    setIsProcessing(true);
    const newImages: ProcessedImage[] = [];
    
    for (const file of files) {
      try {
        const dataUrl = await readFileAsDataURL(file);
        const { width, height, boxes } = await detectPhotos(dataUrl);
        
        newImages.push({
          id: Math.random().toString(36).substr(2, 9),
          file,
          dataUrl,
          width,
          height,
          boxes
        });
      } catch (err) {
        console.error('Failed to process image:', file.name, err);
      }
    }
    
    setImages(prev => {
      const combined = [...prev, ...newImages];
      if (combined.length > 0 && !activeImageId) {
        setActiveImageId(combined[0].id);
      }
      return combined;
    });
    setIsProcessing(false);
  };

  const handleSaveAll = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);
    
    const zip = new JSZip();
    
    // We need to crop images based on the boxes using canvas
    const cropImage = (image: ProcessedImage, box: typeof image.boxes[0], index: number): Promise<Blob> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = box.width;
          canvas.height = box.height;
          const ctx = canvas.getContext('2d')!;
          
          ctx.drawImage(
            img,
            box.x, box.y, box.width, box.height,
            0, 0, box.width, box.height
          );
          
          canvas.toBlob((blob) => {
            resolve(blob!);
          }, 'image/jpeg', 0.95);
        };
        img.src = image.dataUrl;
      });
    };

    let totalSaved = 0;
    
    for (const image of images) {
      const baseName = image.file.name.replace(/\.[^/.]+$/, "");
      for (let i = 0; i < image.boxes.length; i++) {
        const box = image.boxes[i];
        const blob = await cropImage(image, box, i);
        zip.file(`${baseName}_cropped_${i + 1}.jpg`, blob);
        totalSaved++;
      }
    }
    
    if (totalSaved > 0) {
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'cropped_photos.zip');
    }
    
    setIsProcessing(false);
  };

  const handleFinishReview = () => {
    if (window.confirm("Are you sure you want to finish the review? This will clear all current work.")) {
      setImages([]);
      setActiveImageId(null);
    }
  };

  if (images.length === 0) {
    return (
      <div className="relative min-h-screen bg-[#121212]">
        {isProcessing && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}
        <StartScreen onFilesSelected={handleFilesSelected} />
      </div>
    );
  }

  const activeImage = images.find(img => img.id === activeImageId);

  return (
    <div className="flex flex-col h-screen bg-[#121212] overflow-hidden font-sans text-gray-200">
      {isProcessing && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}
      
      {/* Top Toolbar */}
      <header className="h-14 bg-[#1e1e1e] border-b border-white/10 flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <span className="font-bold tracking-tight text-white uppercase">AUTOSPLIT v2.4</span>
          </div>
          <div className="flex gap-1">
             <span className="text-[10px] text-gray-400 font-mono tracking-widest uppercase ml-4">Reviewing {images.length} scans</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            System Ready
          </div>
          <button 
            onClick={handleSaveAll}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white rounded shadow-lg flex items-center gap-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            Save All ({images.reduce((acc, img) => acc + img.boxes.length, 0)})
          </button>
          <button 
            onClick={handleFinishReview}
            className="px-4 py-1.5 bg-transparent hover:bg-white/10 text-xs font-bold text-blue-400 rounded transition-colors"
          >
            Finish Review
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden relative">
        <Sidebar 
          images={images} 
          activeImageId={activeImageId} 
          onSelectImage={setActiveImageId} 
        />
        
        {activeImage ? (
          <Workspace 
            image={activeImage}
            onUpdateImage={(updated) => {
              setImages(prev => prev.map(img => img.id === updated.id ? updated : img));
            }}
          />
        ) : (
          <section className="flex-1 bg-[#0f0f0f] relative flex items-center justify-center min-w-0">
            <div className="text-gray-500 text-xs font-mono uppercase tracking-widest">
              Select an image from the sidebar to review
            </div>
          </section>
        )}
      </main>

      {/* Footer Bar */}
      <footer className="h-10 bg-[#141414] border-t border-white/10 flex items-center justify-between px-4 shrink-0 text-[11px] z-20">
        <div className="flex gap-6 text-gray-500">
          <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z" /></svg> Review Session Active</span>
          <span>Format: JPG</span>
          <span>Workspace: Local Memory</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-400 font-mono tracking-widest">PROCESSED: {images.length} FILES</span>
          <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full w-[100%]"></div>
          </div>
          <button 
            onClick={handleFinishReview}
            className="ml-4 text-blue-400 font-bold hover:text-blue-300 transition-colors"
          >
            FINISH REVIEW
          </button>
        </div>
      </footer>
    </div>
  );
}
