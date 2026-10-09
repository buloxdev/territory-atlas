import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            // MapLibre ships its rendering code and shared geometry code as separate
            // modules. Keep them separate instead of combining them into one big chunk.
            { name: 'maplibre-shared', test: /maplibre-gl\/dist\/maplibre-gl-shared\.mjs$/ },
          ],
        },
      },
    },
  },
});
