import React, { useCallback, useRef } from 'react';
import { Upload, FolderOpen, Image as ImageIcon } from 'lucide-react';

interface StartScreenProps {
  onFilesSelected: (files: File[]) => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({ onFilesSelected }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      onFilesSelected(files);
    }
  }, [onFilesSelected]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
      onFilesSelected(files);
    }
  };

  return (
    <div 
      className="flex flex-col items-center justify-center min-h-screen bg-[#121212] p-6 text-gray-200"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <div className="max-w-2xl w-full bg-[#181818] rounded-2xl p-12 text-center border-2 border-dashed border-white/10">
        <ImageIcon className="w-20 h-20 mx-auto text-blue-500 mb-6" />
        <h1 className="text-3xl font-bold text-white mb-4 tracking-tight">AutoSplitter Photo Scanning</h1>
        <p className="text-gray-400 mb-8 max-w-lg mx-auto leading-relaxed text-sm">
          Scan multiple photos at once. Open pre-scanned files and we will detect and auto crop individual photos from each scanned image.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-white px-6 py-3 rounded-lg font-medium transition-colors border border-white/5"
          >
            <Upload className="w-5 h-5" />
            Open File(s)
          </button>
          
          <button 
            onClick={() => folderInputRef.current?.click()}
            className="flex items-center justify-center gap-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-white px-6 py-3 rounded-lg font-medium transition-colors border border-white/5"
          >
            <FolderOpen className="w-5 h-5" />
            Open Folder
          </button>
        </div>

        <p className="mt-8 text-xs text-gray-500 font-medium uppercase tracking-widest">
          Or simply drag and drop images here
        </p>

        <input 
          type="file" 
          multiple 
          accept="image/*" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        <input 
          type="file" 
          {...{webkitdirectory: "", directory: ""} as any}
          className="hidden" 
          ref={folderInputRef}
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
};
