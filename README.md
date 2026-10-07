# Room Dimension Visualizer

## Setup and Run

### Prerequisites
- Node.js (v14 or newer)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install
# or
yarn install
```

### Running the Application

```bash
# Start development server
npm run dev
# or
yarn dev
```

The application will be available at http://localhost:5173/ (or another port if 5173 is in use).

### Building for Production

```bash
# Build for production
npm run build
# or
yarn build
```

## Dependency security

Use Node.js 22.22.2 or newer (CI uses Node.js 24). Install reproducibly with
`npm ci`, then run `npm audit`, `npm run build`, `npm run lint`, and
`npm run test:unit -- --run`. Vitest 5 includes the worker and mock-server
security fixes. Vue and TypeScript lint rules use their official flat configs
directly, avoiding the unpatched `fast-glob` / `braces` discovery dependency.
Dependabot checks npm packages and GitHub Actions weekly.
