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
      
      // Histogram for border pixels to find the most common color (background)
      const colorBins = new Map<string, number>();
      const binSize = 16;
      let maxCount = 0;
      let bgBin = {r: 255, g: 255, b: 255};
      
      const samplePixel = (idx: number) => {
        const r = Math.floor(data[idx] / binSize) * binSize + (binSize / 2);
        const g = Math.floor(data[idx + 1] / binSize) * binSize + (binSize / 2);
        const b = Math.floor(data[idx + 2] / binSize) * binSize + (binSize / 2);
        const key = `${r},${g},${b}`;
        const count = (colorBins.get(key) || 0) + 1;
        colorBins.set(key, count);
        if (count > maxCount) {
          maxCount = count;
          bgBin = {r, g, b};
        }
      };
      
      // Sample a 4-pixel thick border
      for (let x = 0; x < width; x++) {
        for (let y of [0, 1, 2, 3, height - 4, height - 3, height - 2, height - 1]) {
          samplePixel((y * width + x) * 4);
        }
      }
      for (let y = 0; y < height; y++) {
        for (let x of [0, 1, 2, 3, width - 4, width - 3, width - 2, width - 1]) {
          samplePixel((y * width + x) * 4);
        }
      }
      
      // Grid based component finding to be fast and robust
      const gridBoxSize = 8;
      const gridW = Math.ceil(width / gridBoxSize);
      const gridH = Math.ceil(height / gridBoxSize);
      const grid = new Array(gridW * gridH).fill(false);
      
      for (let gy = 0; gy < gridH; gy++) {
        for (let gx = 0; gx < gridW; gx++) {
          let sumR = 0, sumG = 0, sumB = 0;
          let sumL = 0;
          let sqSumL = 0;
          let count = 0;
          
          for (let y = gy * gridBoxSize; y < Math.min((gy + 1) * gridBoxSize, height); y++) {
            for (let x = gx * gridBoxSize; x < Math.min((gx + 1) * gridBoxSize, width); x++) {
              const idx = (y * width + x) * 4;
              const r = data[idx], g = data[idx+1], b = data[idx+2];
              sumR += r; sumG += g; sumB += b;
              
              const l = 0.299 * r + 0.587 * g + 0.114 * b;
              sumL += l;
              sqSumL += l * l;
              count++;
            }
          }
          
          const avgR = sumR / count;
          const avgG = sumG / count;
          const avgB = sumB / count;
          const avgL = sumL / count;
          const varL = (sqSumL / count) - (avgL * avgL);
          
          const dist = Math.sqrt((avgR-bgBin.r)**2 + (avgG-bgBin.g)**2 + (avgB-bgBin.b)**2);
          
          // Foreground if color is different OR variance is high (texture)
          if (dist > 35 || varL > 200) {
            grid[gy * gridW + gx] = true;
          }
        }
      }

      // Morphological operations
      const morph = (input: boolean[], iters: number, isErode: boolean) => {
        let current = [...input];
        for (let i = 0; i < iters; i++) {
          const next = new Array(gridW * gridH).fill(isErode ? true : false);
          for (let y = 0; y < gridH; y++) {
            for (let x = 0; x < gridW; x++) {
               let val = current[y * gridW + x];
               if (isErode) {
                 for (let ny = Math.max(0, y-1); ny <= Math.min(gridH-1, y+1); ny++) {
                   for (let nx = Math.max(0, x-1); nx <= Math.min(gridW-1, x+1); nx++) {
                     if (!current[ny * gridW + nx]) val = false;
                   }
                 }
               } else {
                 for (let ny = Math.max(0, y-1); ny <= Math.min(gridH-1, y+1); ny++) {
                   for (let nx = Math.max(0, x-1); nx <= Math.min(gridW-1, x+1); nx++) {
                     if (current[ny * gridW + nx]) val = true;
                   }
                 }
               }
               next[y * gridW + x] = val;
            }
          }
          current = next;
        }
        return current;
      };

      // Clean up the grid
      let cleanGrid = morph(grid, 1, true); // Erode noise
      cleanGrid = morph(cleanGrid, 4, false); // Dilate to connect broken pieces
      cleanGrid = morph(cleanGrid, 2, true); // Erode slightly to shrink back

      // Find connected components
      const visited = new Array(gridW * gridH).fill(false);
      const components: {minX: number, minY: number, maxX: number, maxY: number}[] = [];
      
      for (let i = 0; i < cleanGrid.length; i++) {
        if (cleanGrid[i] && !visited[i]) {
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
            
            for (let ny = Math.max(0, cy - 1); ny <= Math.min(gridH - 1, cy + 1); ny++) {
              for (let nx = Math.max(0, cx - 1); nx <= Math.min(gridW - 1, cx + 1); nx++) {
                const nIdx = ny * gridW + nx;
                if (cleanGrid[nIdx] && !visited[nIdx]) {
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
      const minDimension = Math.max(80, Math.min(width, height) * 0.08);
      
      components.forEach(comp => {
        const x = (comp.minX * gridBoxSize) / scale;
        const y = (comp.minY * gridBoxSize) / scale;
        const w = ((comp.maxX - comp.minX + 1) * gridBoxSize) / scale;
        const h = ((comp.maxY - comp.minY + 1) * gridBoxSize) / scale;
        
        if (w > minDimension && h > minDimension) {
          boxes.push({
            id: Math.random().toString(36).substr(2, 9),
            x: Math.max(0, x - 15), 
            y: Math.max(0, y - 15),
            width: Math.min(img.width - Math.max(0, x - 15), w + 30),
            height: Math.min(img.height - Math.max(0, y - 15), h + 30)
          });
        }
      });
      
      // Fallback
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
