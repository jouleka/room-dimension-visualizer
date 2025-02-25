<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import type { RoomData, RoomDimension, Dimension, NormalizedDimension } from '@/types/room';

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

const roomDimensions = computed<RoomDimension[]>(() => {
  if (!coordinates.value) return [];

  const dimensions: RoomDimension[] = [];

  for (const wall of props.roomData.walls) {
    const startCorner = props.roomData.corners.find(c => c.wallStarts.some(w => w.id === wall.id));
    const endCorner = props.roomData.corners.find(c => c.wallEnds.some(w => w.id === wall.id));
    if (!startCorner || !endCorner) continue;

    const dx = endCorner.x - startCorner.x;
    const dy = endCorner.y - startCorner.y;
    const angle = Math.atan2(dy, dx);

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
      normLength.x1.toFixed(2),
      normLength.y1.toFixed(2),
      normLength.x2.toFixed(2),
      normLength.y2.toFixed(2),
      normWidth.x1.toFixed(2),
      normWidth.y1.toFixed(2),
      normWidth.x2.toFixed(2),
      normWidth.y2.toFixed(2)
    ].join('|');

    if (!seen.has(key)) {
      seen.add(key);
      uniqueDimensions.push({
        length: normLength,
        width: normWidth
      });
    }
  }

  return uniqueDimensions;
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

  for (const wall of props.roomData.walls) {
    const startCorner = props.roomData.corners.find(c => c.wallStarts.some(w => w.id === wall.id));
    const endCorner = props.roomData.corners.find(c => c.wallEnds.some(w => w.id === wall.id));

    if (startCorner && endCorner) {
      context.moveTo(transformX(startCorner.x), transformY(startCorner.y));
      context.lineTo(transformX(endCorner.x), transformY(endCorner.y));
    }
  }

  context.stroke();
};

const drawDimensions = (context: CanvasRenderingContext2D) => {
  if (!roomDimensions.value.length) return;

  const currentDimension = roomDimensions.value[currentDimensionOption.value];

  // length (red)
  context.beginPath();
  context.strokeStyle = 'red';
  context.lineWidth = 2;
  context.moveTo(transformX(currentDimension.length.x1), transformY(currentDimension.length.y1));
  context.lineTo(transformX(currentDimension.length.x2), transformY(currentDimension.length.y2));
  context.stroke();

  // width (blue)
  context.beginPath();
  context.strokeStyle = 'blue';
  context.lineWidth = 2;
  context.moveTo(transformX(currentDimension.width.x1), transformY(currentDimension.width.y1));
  context.lineTo(transformX(currentDimension.width.x2), transformY(currentDimension.width.y2));
  context.stroke();

  context.font = '14px Arial';

  context.fillStyle = 'red';
  const lengthMidX = (transformX(currentDimension.length.x1) + transformX(currentDimension.length.x2)) / 2;
  const lengthMidY = (transformY(currentDimension.length.y1) + transformY(currentDimension.length.y2)) / 2;
  context.fillText(`Length: ${currentDimension.length.value.toFixed(2)}`, lengthMidX, lengthMidY - 10);

  context.fillStyle = 'blue';
  const widthMidX = (transformX(currentDimension.width.x1) + transformX(currentDimension.width.x2)) / 2;
  const widthMidY = (transformY(currentDimension.width.y1) + transformY(currentDimension.width.y2)) / 2;
  context.fillText(`Width: ${currentDimension.width.value.toFixed(2)}`, widthMidX - 10, widthMidY);
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
