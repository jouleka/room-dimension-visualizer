<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="app">
  <header>
      <h1>Room Dimension Visualizer</h1>
  </header>

    <main>
  <RouterView />
    </main>

    <footer>
      <p>Room Dimension Visualizer - DocuSketch Task</p>
    </footer>
  </div>
</template>

<style>
/* Global styles */
:root {
  --color-background: #f8f9fa;
  --color-text: #2c3e50;
  --color-primary: #3498db;
  --color-secondary: #2ecc71;
  --color-accent: #e74c3c;
  --color-border: #ddd;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--color-text);
  background-color: var(--color-background);
  line-height: 1.6;
}

.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

header {
  background-color: var(--color-primary);
  color: white;
  padding: 1rem;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

main {
  flex: 1;
  padding: 1rem;
  }

footer {
  background-color: #34495e;
  color: white;
  text-align: center;
  padding: 1rem;
  margin-top: auto;
}
</style>
