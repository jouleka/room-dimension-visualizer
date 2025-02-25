<script setup lang="ts">
import { ref, onMounted } from 'vue'
import RoomVisualizer from '@/components/RoomVisualizer.vue'
import type { RoomData } from '@/types/room'

const roomData = ref<RoomData | null>(null)
const roomTypes = ['simple', 'triangle', 't_shape'] as const
type RoomType = typeof roomTypes[number]

const currentRoomType = ref<RoomType | ''>('')
const error = ref<string | null>(null)
const isLoading = ref(false)

const loadRoomData = async (type: RoomType) => {
  error.value = null
  isLoading.value = true

  try {
    const response = await fetch(`/${type}.json`)
    if (!response.ok) {
      throw new Error(`Failed to load ${type}.json`)
    }
    const data = await response.json()
    roomData.value = data
    currentRoomType.value = type
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load room data'
    roomData.value = null
  } finally {
    isLoading.value = false
  }
}

const loadRandomRoom = () => {
  const randomIndex = Math.floor(Math.random() * roomTypes.length)
  const randomType = roomTypes[randomIndex]
  loadRoomData(randomType)
}

// load a random room on mount
onMounted(() => {
  loadRandomRoom()
})
</script>

<template>
  <main>
    <div class="room-container">
      <h1>Room Visualizer</h1>

      <div class="room-controls">
        <button
          @click="loadRandomRoom"
          class="room-button"
          :disabled="isLoading"
        >
          {{ isLoading ? 'Loading...' : 'Load Random Room' }}
        </button>

        <div class="room-selector">
          <button
            v-for="type in roomTypes"
            :key="type"
            @click="loadRoomData(type)"
            :class="[
              'room-type-button',
              {
                active: currentRoomType === type,
                loading: isLoading && currentRoomType === type
              }
            ]"
            :disabled="isLoading"
          >
            {{ type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ') }}
          </button>
        </div>
      </div>

      <div v-if="error" class="error">
        {{ error }}
      </div>

      <div v-else-if="roomData" class="visualizer-container">
        <RoomVisualizer :roomData="roomData" />
      </div>
      <div v-else class="loading">
        Loading room data...
      </div>
    </div>
  </main>
</template>

<style scoped>
.room-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  text-align: center;
}

h1 {
  margin-bottom: 20px;
  color: #2c3e50;
}

.room-controls {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.room-button {
  padding: 10px 20px;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  margin-bottom: 15px;
  min-width: 180px;
}

.room-button:hover:not(:disabled) {
  background-color: #2980b9;
}

.room-button:disabled {
  background-color: #95a5a6;
  cursor: not-allowed;
}

.room-selector {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 10px;
}

.room-type-button {
  padding: 8px 15px;
  background-color: #ecf0f1;
  color: #34495e;
  border: 1px solid #bdc3c7;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  min-width: 120px;
}

.room-type-button:hover:not(:disabled) {
  background-color: #e0e6e8;
}

.room-type-button.active {
  background-color: #34495e;
  color: white;
}

.room-type-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.room-type-button.loading {
  position: relative;
  color: transparent;
}

.room-type-button.loading::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 16px;
  height: 16px;
  margin: -8px 0 0 -8px;
  border: 2px solid #34495e;
  border-top-color: transparent;
  border-radius: 50%;
  animation: button-loading-spinner 1s linear infinite;
}

@keyframes button-loading-spinner {
  from {
    transform: rotate(0turn);
  }
  to {
    transform: rotate(1turn);
  }
}

.visualizer-container {
  margin-top: 20px;
}

.loading {
  margin-top: 50px;
  font-size: 18px;
  color: #7f8c8d;
}

.error {
  margin-top: 20px;
  padding: 15px;
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
}
</style>
