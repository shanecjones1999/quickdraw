import { useState, useEffect } from 'react';

// The board is 4 cols wide. Given available viewport width, compute a cell size
// that fits comfortably with some horizontal padding.
export function useCellSize(cols = 4, paddingPx = 48, maxCell = 80): number {
  const [cellSize, setCellSize] = useState(() =>
    Math.min(maxCell, Math.floor((Math.min(window.innerWidth, 480) - paddingPx) / cols))
  );

  useEffect(() => {
    function update() {
      setCellSize(Math.min(maxCell, Math.floor((Math.min(window.innerWidth, 480) - paddingPx) / cols)));
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [cols, paddingPx, maxCell]);

  return cellSize;
}
