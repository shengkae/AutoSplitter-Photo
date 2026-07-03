import { Box } from '../types';

export const detectPhotos = async (imageSrc: string): Promise<{ width: number, height: number, boxes: Box[] }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_DIM = 1000; // max dimension for processing
      let scale = 1;
      
      let width = img.width;
      let height = img.height;
      
      // Scale down for processing to make it faster
      if (width > MAX_DIM || height > MAX_DIM) {
        scale = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      
      // Guess background color by sampling the edges
      let bgR = 0, bgG = 0, bgB = 0;
      let count = 0;
      for (let x = 0; x < width; x++) {
        for (let y of [0, height - 1]) {
          const idx = (y * width + x) * 4;
          bgR += data[idx];
          bgG += data[idx + 1];
          bgB += data[idx + 2];
          count++;
        }
      }
      for (let y = 0; y < height; y++) {
        for (let x of [0, width - 1]) {
          const idx = (y * width + x) * 4;
          bgR += data[idx];
          bgG += data[idx + 1];
          bgB += data[idx + 2];
          count++;
        }
      }
      bgR /= count; bgG /= count; bgB /= count;
      
      const threshold = 40; // Color distance threshold
      const isForeground = (r: number, g: number, b: number) => {
        const dist = Math.sqrt((r-bgR)**2 + (g-bgG)**2 + (b-bgB)**2);
        return dist > threshold;
      };
      
      // Grid based component finding to be fast
      const gridBoxSize = 5;
      const gridW = Math.ceil(width / gridBoxSize);
      const gridH = Math.ceil(height / gridBoxSize);
      const grid = new Array(gridW * gridH).fill(false);
      
      for (let gy = 0; gy < gridH; gy++) {
        for (let gx = 0; gx < gridW; gx++) {
          let fgCount = 0;
          for (let y = gy * gridBoxSize; y < Math.min((gy + 1) * gridBoxSize, height); y++) {
            for (let x = gx * gridBoxSize; x < Math.min((gx + 1) * gridBoxSize, width); x++) {
              const idx = (y * width + x) * 4;
              if (isForeground(data[idx], data[idx + 1], data[idx + 2])) {
                fgCount++;
              }
            }
          }
          if (fgCount > (gridBoxSize * gridBoxSize) * 0.1) {
            grid[gy * gridW + gx] = true;
          }
        }
      }
      
      // Find connected components in grid
      const visited = new Array(gridW * gridH).fill(false);
      const components: {minX: number, minY: number, maxX: number, maxY: number}[] = [];
      
      for (let i = 0; i < grid.length; i++) {
        if (grid[i] && !visited[i]) {
          let minX = gridW, minY = gridH, maxX = 0, maxY = 0;
          const queue = [i];
          visited[i] = true;
          
          while (queue.length > 0) {
            const curr = queue.shift()!;
            const cy = Math.floor(curr / gridW);
            const cx = curr % gridW;
            
            minX = Math.min(minX, cx);
            minY = Math.min(minY, cy);
            maxX = Math.max(maxX, cx);
            maxY = Math.max(maxY, cy);
            
            // Look around more generously to connect nearby blobs (e.g., slight tears)
            for (let ny = Math.max(0, cy - 2); ny <= Math.min(gridH - 1, cy + 2); ny++) {
              for (let nx = Math.max(0, cx - 2); nx <= Math.min(gridW - 1, cx + 2); nx++) {
                const nIdx = ny * gridW + nx;
                if (grid[nIdx] && !visited[nIdx]) {
                  visited[nIdx] = true;
                  queue.push(nIdx);
                }
              }
            }
          }
          components.push({minX, minY, maxX, maxY});
        }
      }
      
      const boxes: Box[] = [];
      // Filter out small noise
      const minDimension = Math.max(50, Math.min(width, height) * 0.05);
      
      components.forEach(comp => {
        const x = (comp.minX * gridBoxSize) / scale;
        const y = (comp.minY * gridBoxSize) / scale;
        const w = ((comp.maxX - comp.minX + 1) * gridBoxSize) / scale;
        const h = ((comp.maxY - comp.minY + 1) * gridBoxSize) / scale;
        
        if (w > minDimension && h > minDimension) {
          boxes.push({
            id: Math.random().toString(36).substr(2, 9),
            x: Math.max(0, x - 10), // slight padding
            y: Math.max(0, y - 10),
            width: Math.min(img.width - x, w + 20),
            height: Math.min(img.height - y, h + 20)
          });
        }
      });
      
      // Fallback if no boxes found, just add one big box
      if (boxes.length === 0) {
         boxes.push({
            id: Math.random().toString(36).substr(2, 9),
            x: img.width * 0.1,
            y: img.height * 0.1,
            width: img.width * 0.8,
            height: img.height * 0.8
         });
      }
      
      resolve({ width: img.width, height: img.height, boxes });
    };
    img.src = imageSrc;
  });
};

export const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
