<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import type { RoomData, RoomDimension, Dimension, NormalizedDimension, Corner } from '@/types/room';

const props = defineProps<{
  roomData: RoomData;
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
const ctx = ref<CanvasRenderingContext2D | null>(null);
const canvasWidth = ref(800);
const canvasHeight = ref(600);
const padding = 50;
const currentDimensionOption = ref(0);

// properties for coordinate transformation
const coordinates = computed(() => {
  if (!props.roomData?.corners?.length) return null;

  const xValues = props.roomData.corners.map(corner => corner.x);
  const yValues = props.roomData.corners.map(corner => corner.y);

  return {
    minX: Math.min(...xValues),
    maxX: Math.max(...xValues),
    minY: Math.min(...yValues),
    maxY: Math.max(...yValues),
  };
});

const scale = computed(() => {
  if (!coordinates.value) return 1;

  const { minX, maxX, minY, maxY } = coordinates.value;
  const roomWidth = maxX - minX;
  const roomHeight = maxY - minY;

  const scaleX = (canvasWidth.value - padding * 2) / roomWidth;
  const scaleY = (canvasHeight.value - padding * 2) / roomHeight;

  return Math.min(scaleX, scaleY);
});

const transformX = (x: number) => {
  if (!coordinates.value) return x;
  return (x - coordinates.value.minX) * scale.value + padding;
};

const transformY = (y: number) => {
  if (!coordinates.value) return y;
  return (y - coordinates.value.minY) * scale.value + padding;
};

// finding the extreme points of the room in a given direction
const findExtremePoints = (angle: number) => {
  if (!props.roomData?.corners?.length) return null;

  // calc direction vector
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);

  // projecting all corners onto this direction
  const projections = props.roomData.corners.map(corner => {
    const proj = corner.x * dirX + corner.y * dirY;
    return { corner, proj };
  });

  // min and max projections
  const minProj = projections.reduce((min, p) => p.proj < min.proj ? p : min, projections[0]);
  const maxProj = projections.reduce((max, p) => p.proj > max.proj ? p : max, projections[0]);

  return { min: minProj.corner, max: maxProj.corner };
};

const isWallAlignedWithAxis = (startCorner: Corner, endCorner: Corner) => {
  const dx = Math.abs(endCorner.x - startCorner.x);
  const dy = Math.abs(endCorner.y - startCorner.y);

  // wall is horizontal or vertical if one of the dimensions is very small
  return dx < 0.01 || dy < 0.01;
};

// find walls that are aligned with main axes
const findAlignedWalls = () => {
  const alignedWalls = [];

  for (const wall of props.roomData.walls) {
    const startCorner = props.roomData.corners.find(c => c.wallStarts.some(w => w.id === wall.id));
    const endCorner = props.roomData.corners.find(c => c.wallEnds.some(w => w.id === wall.id));

    if (!startCorner || !endCorner) continue;

    if (isWallAlignedWithAxis(startCorner, endCorner)) {
      alignedWalls.push({
        id: wall.id,
        startCorner,
        endCorner,
        isHorizontal: Math.abs(endCorner.y - startCorner.y) < 0.01,
        length: Math.hypot(endCorner.x - startCorner.x, endCorner.y - startCorner.y)
      });
    }
  }

  return alignedWalls;
};

const normalizeDimension = (dim: Dimension): NormalizedDimension => {
  let x1 = dim.x1;
  let y1 = dim.y1;
  let x2 = dim.x2;
  let y2 = dim.y2;

  if (x1 > x2 || (x1 === x2 && y1 > y2)) {
    [x1, x2] = [x2, x1];
    [y1, y2] = [y2, y1];
  }
  return { x1, y1, x2, y2, value: dim.value };
};

//  function to check if a point is on or very close to any wall
const isPointNearWall = (x: number, y: number, tolerance = 0.5) => {
  for (const wall of props.roomData.walls) {
    const startCorner = props.roomData.corners.find(c => c.wallStarts.some(w => w.id === wall.id));
    const endCorner = props.roomData.corners.find(c => c.wallEnds.some(w => w.id === wall.id));

    if (!startCorner || !endCorner) continue;

    const wallLength = Math.hypot(
      endCorner.x - startCorner.x,
      endCorner.y - startCorner.y
    );

    // vector math to find distance from point to line segment
    const t = Math.max(0, Math.min(1, (
      (x - startCorner.x) * (endCorner.x - startCorner.x) +
      (y - startCorner.y) * (endCorner.y - startCorner.y)
    ) / (wallLength * wallLength)));

    const nearestX = startCorner.x + t * (endCorner.x - startCorner.x);
    const nearestY = startCorner.y + t * (endCorner.y - startCorner.y);

    const distance = Math.hypot(x - nearestX, y - nearestY);

    if (distance <= tolerance) {
      return true;
    }
  }
  return false;
};

const isParallelToWall = (x1: number, y1: number, x2: number, y2: number, tolerance = 0.01) => {
  const lineAngle = Math.atan2(y2 - y1, x2 - x1);

  for (const wall of props.roomData.walls) {
    const startCorner = props.roomData.corners.find(c => c.wallStarts.some(w => w.id === wall.id));
    const endCorner = props.roomData.corners.find(c => c.wallEnds.some(w => w.id === wall.id));

    if (!startCorner || !endCorner) continue;

    const wallAngle = Math.atan2(
      endCorner.y - startCorner.y,
      endCorner.x - startCorner.x
    );

    const angleDiff = Math.abs((lineAngle - wallAngle) % Math.PI);
    if (angleDiff < tolerance || Math.abs(angleDiff - Math.PI) < tolerance) {
      return true;
    }
  }
  return false;
};

const roomDimensions = computed<RoomDimension[]>(() => {
  if (!coordinates.value) return [];

  const dimensions: RoomDimension[] = [];
  const alignedWalls = findAlignedWalls();

  // if we have aligned walls we use them to determine length and width
  if (alignedWalls.length > 0) {
    const horizontalWalls = alignedWalls
      .filter(w => w.isHorizontal)
      .sort((a, b) => b.length - a.length);

    const verticalWalls = alignedWalls
      .filter(w => !w.isHorizontal)
      .sort((a, b) => b.length - a.length);

    // using the longest walls in each direction as primary length/width indicators
    if (horizontalWalls.length > 0 && verticalWalls.length > 0) {
      // first we try longest walls in each direction
      const hWall = horizontalWalls[0];
      const vWall = verticalWalls[0];

      const length = {
        x1: hWall.startCorner.x,
        y1: hWall.startCorner.y,
        x2: hWall.endCorner.x,
        y2: hWall.endCorner.y,
        value: hWall.length
      };

      const width = {
        x1: vWall.startCorner.x,
        y1: vWall.startCorner.y,
        x2: vWall.endCorner.x,
        y2: vWall.endCorner.y,
        value: vWall.length
      };

      dimensions.push({ length, width });

      for (let i = 0; i < Math.min(3, horizontalWalls.length); i++) {
        for (let j = 0; j < Math.min(3, verticalWalls.length); j++) {
          if (i === 0 && j === 0) continue;

          const hWall = horizontalWalls[i];
          const vWall = verticalWalls[j];

          const length = {
            x1: hWall.startCorner.x,
            y1: hWall.startCorner.y,
            x2: hWall.endCorner.x,
            y2: hWall.endCorner.y,
            value: hWall.length
          };

          const width = {
            x1: vWall.startCorner.x,
            y1: vWall.startCorner.y,
            x2: vWall.endCorner.x,
            y2: vWall.endCorner.y,
            value: vWall.length
          };

          dimensions.push({ length, width });
        }
      }
    }
  }

  // if we can't find aligned walls or need more options we use the extreme points method
  if (dimensions.length === 0 || props.roomData.corners.length <= 4) {
    // trying common angles for rectangular-like rooms
    const angles = [0, Math.PI/2, Math.PI/4, Math.PI*3/4];

    for (const angle of angles) {
      // finding extreme points for length along the wall direction
      const lengthExtremes = findExtremePoints(angle);
      if (!lengthExtremes) continue;

      const length = {
        x1: lengthExtremes.min.x,
        y1: lengthExtremes.min.y,
        x2: lengthExtremes.max.x,
        y2: lengthExtremes.max.y,
        value: Math.hypot(
          lengthExtremes.max.x - lengthExtremes.min.x,
          lengthExtremes.max.y - lengthExtremes.min.y
        )
      };

      // finding extreme points for width perpendicular to the wall direction
      const perpAngle = angle + Math.PI / 2;
      const widthExtremes = findExtremePoints(perpAngle);
      if (!widthExtremes) continue;

      const width = {
        x1: widthExtremes.min.x,
        y1: widthExtremes.min.y,
        x2: widthExtremes.max.x,
        y2: widthExtremes.max.y,
        value: Math.hypot(
          widthExtremes.max.x - widthExtremes.min.x,
          widthExtremes.max.y - widthExtremes.min.y
        )
      };

      dimensions.push({ length, width });
    }

    // for triangles we use the longest side as length and height as width
    if (props.roomData.corners.length === 3) {
      const corners = props.roomData.corners;
      let maxDist = 0;
      let longestSide = { start: corners[0], end: corners[1] };

      // longest side
      for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 3; j++) {
          const dist = Math.hypot(corners[j].x - corners[i].x, corners[j].y - corners[i].y);
          if (dist > maxDist) {
            maxDist = dist;
            longestSide = { start: corners[i], end: corners[j] };
          }
        }
      }

      // third corner that's not part of the longest side
      const thirdCorner = corners.find(c =>
        c.id !== longestSide.start.id && c.id !== longestSide.end.id);

      if (thirdCorner) {
        const baseVec = {
          x: longestSide.end.x - longestSide.start.x,
          y: longestSide.end.y - longestSide.start.y
        };
        const baseLength = Math.hypot(baseVec.x, baseVec.y);

        const unitBase = {
          x: baseVec.x / baseLength,
          y: baseVec.y / baseLength
        };

        // perpendicular unit vector
        const perpUnit = {
          x: -unitBase.y,
          y: unitBase.x
        };

        const toThirdVec = {
          x: thirdCorner.x - longestSide.start.x,
          y: thirdCorner.y - longestSide.start.y
        };

        // projecting this vector onto the perpendicular to get height
        const height = Math.abs(toThirdVec.x * perpUnit.x + toThirdVec.y * perpUnit.y);

        const length = {
          x1: longestSide.start.x,
          y1: longestSide.start.y,
          x2: longestSide.end.x,
          y2: longestSide.end.y,
          value: baseLength
        };

        const midBaseX = (longestSide.start.x + longestSide.end.x) / 2;
        const midBaseY = (longestSide.start.y + longestSide.end.y) / 2;

        const width = {
          x1: midBaseX,
          y1: midBaseY,
          x2: midBaseX + perpUnit.x * height,
          y2: midBaseY + perpUnit.y * height,
          value: height
        };

        dimensions.push({ length, width });
      }
    }
  }

  dimensions.sort((a, b) =>
    b.length.value - a.length.value ||
    b.width.value - a.width.value
  );

  const uniqueDimensions: RoomDimension[] = [];
  const seen = new Set<string>();

  for (const dim of dimensions) {
    const normLength = normalizeDimension(dim.length);
    const normWidth = normalizeDimension(dim.width);

    // unique key for comparison
    const key = [
      normLength.x1.toFixed(1),
      normLength.y1.toFixed(1),
      normLength.x2.toFixed(1),
      normLength.y2.toFixed(1),
      normWidth.x1.toFixed(1),
      normWidth.y1.toFixed(1),
      normWidth.x2.toFixed(1),
      normWidth.y2.toFixed(1)
    ].join('|');

    if (!seen.has(key)) {
      seen.add(key);
      uniqueDimensions.push({
        length: normLength,
        width: normWidth
      });
    }
  }

  // filtering dimensions to only keep those that meet the criteria
  return uniqueDimensions.filter(dim => {
    const { length, width } = dim;

    const isLengthParallel = isParallelToWall(length.x1, length.y1, length.x2, length.y2);
    const isWidthParallel = isParallelToWall(width.x1, width.y1, width.x2, width.y2);

    if (!isLengthParallel && !isWidthParallel) {
      return false;
    }

    const lengthStartOnWall = isPointNearWall(length.x1, length.y1);
    const lengthEndOnWall = isPointNearWall(length.x2, length.y2);
    const widthStartOnWall = isPointNearWall(width.x1, width.y1);
    const widthEndOnWall = isPointNearWall(width.x2, width.y2);

    return lengthStartOnWall && lengthEndOnWall && widthStartOnWall && widthEndOnWall;
  });
});

const changeDimensionOption = () => {
  if (roomDimensions.value.length > 0) {
    currentDimensionOption.value = (currentDimensionOption.value + 1) % roomDimensions.value.length;
  }
};

const drawWalls = (context: CanvasRenderingContext2D) => {
  context.beginPath();
  context.strokeStyle = '#333';
  context.lineWidth = 2;

  let firstCorner = null;
  for (const wall of props.roomData.walls) {
    const startCorner = props.roomData.corners.find(c => c.wallStarts.some(w => w.id === wall.id));
    const endCorner = props.roomData.corners.find(c => c.wallEnds.some(w => w.id === wall.id));

    if (startCorner && endCorner) {
      if (!firstCorner) firstCorner = startCorner;
      context.moveTo(transformX(startCorner.x), transformY(startCorner.y));
      context.lineTo(transformX(endCorner.x), transformY(endCorner.y));
    }
  }
  context.stroke();

  context.fillStyle = '#666';
  for (const corner of props.roomData.corners) {
    context.beginPath();
    context.arc(transformX(corner.x), transformY(corner.y), 4, 0, Math.PI * 2);
    context.fill();
  }
};

const drawDimensions = (context: CanvasRenderingContext2D) => {
  if (!roomDimensions.value.length) return;

  const currentDimension = roomDimensions.value[currentDimensionOption.value];

  // length (red)
  context.beginPath();
  context.strokeStyle = 'red';
  context.lineWidth = 3;
  context.setLineDash([5, 5]);
  context.moveTo(transformX(currentDimension.length.x1), transformY(currentDimension.length.y1));
  context.lineTo(transformX(currentDimension.length.x2), transformY(currentDimension.length.y2));
  context.stroke();

  // width (blue)
  context.beginPath();
  context.strokeStyle = 'blue';
  context.lineWidth = 3;
  context.setLineDash([5, 5]);
  context.moveTo(transformX(currentDimension.width.x1), transformY(currentDimension.width.y1));
  context.lineTo(transformX(currentDimension.width.x2), transformY(currentDimension.width.y2));
  context.stroke();

  // reset line dash
  context.setLineDash([]);

  context.font = 'bold 16px Arial';

  const lengthAngle = Math.atan2(
    currentDimension.length.y2 - currentDimension.length.y1,
    currentDimension.length.x2 - currentDimension.length.x1
  );

  context.fillStyle = 'red';
  const lengthMidX = (transformX(currentDimension.length.x1) + transformX(currentDimension.length.x2)) / 2;
  const lengthMidY = (transformY(currentDimension.length.y1) + transformY(currentDimension.length.y2)) / 2;

  // offset the label perpendicular to the line
  const lengthOffset = 15;
  const lengthOffsetX = Math.sin(lengthAngle) * lengthOffset;
  const lengthOffsetY = -Math.cos(lengthAngle) * lengthOffset;

  context.fillText(`Length: ${currentDimension.length.value.toFixed(2)}`,
    lengthMidX + lengthOffsetX, lengthMidY + lengthOffsetY);

  const widthAngle = Math.atan2(
    currentDimension.width.y2 - currentDimension.width.y1,
    currentDimension.width.x2 - currentDimension.width.x1
  );

  context.fillStyle = 'blue';
  const widthMidX = (transformX(currentDimension.width.x1) + transformX(currentDimension.width.x2)) / 2;
  const widthMidY = (transformY(currentDimension.width.y1) + transformY(currentDimension.width.y2)) / 2;

  // offset the label perpendicular to the line
  const widthOffset = 15;
  const widthOffsetX = Math.sin(widthAngle) * widthOffset;
  const widthOffsetY = -Math.cos(widthAngle) * widthOffset;

  context.fillText(`Width: ${currentDimension.width.value.toFixed(2)}`,
    widthMidX + widthOffsetX, widthMidY + widthOffsetY);

  if (roomDimensions.value.length > 1) {
    context.fillStyle = '#333';
    context.fillText(`Option ${currentDimensionOption.value + 1}/${roomDimensions.value.length}`,
      padding, canvasHeight.value - padding/2);
  }
};

const drawRoom = () => {
  if (!canvas.value || !ctx.value || !props.roomData) return;

  const context = ctx.value;
  context.clearRect(0, 0, canvasWidth.value, canvasHeight.value);

  drawWalls(context);
  drawDimensions(context);
};

onMounted(() => {
  if (canvas.value) {
    ctx.value = canvas.value.getContext('2d');
    drawRoom();
  }
});

watch(() => props.roomData, drawRoom, { deep: true });
watch(() => currentDimensionOption.value, drawRoom);
</script>

<template>
  <div class="room-visualizer">
    <canvas ref="canvas" :width="canvasWidth" :height="canvasHeight"></canvas>
    <div class="controls">
      <button @click="changeDimensionOption" class="dimension-button" :disabled="!roomDimensions.length">
        Change Dimension Option
      </button>
      <div v-if="roomDimensions.length" class="dimension-info">
        <p>Dimension Option: {{ currentDimensionOption + 1 }} / {{ roomDimensions.length }}</p>
        <p>Length (Red): {{ roomDimensions[currentDimensionOption]?.length.value.toFixed(2) }}</p>
        <p>Width (Blue): {{ roomDimensions[currentDimensionOption]?.width.value.toFixed(2) }}</p>
      </div>
      <div v-else class="dimension-info error">
        No valid dimensions found for this room.
      </div>
    </div>
  </div>
</template>

<style scoped>
.room-visualizer {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 20px;
}

canvas {
  border: 1px solid #ccc;
  background-color: #f9f9f9;
}

.controls {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.dimension-button {
  padding: 10px 20px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  margin-bottom: 10px;
}

.dimension-button:hover:not(:disabled) {
  background-color: #45a049;
}

.dimension-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.dimension-info {
  margin-top: 10px;
  text-align: center;
}

.dimension-info p {
  margin: 5px 0;
}

.error {
  color: #721c24;
  background-color: #f8d7da;
  padding: 10px;
  border-radius: 4px;
  border: 1px solid #f5c6cb;
}
</style>
