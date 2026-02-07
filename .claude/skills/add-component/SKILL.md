---
name: add-component
description: Create a new React component following project patterns with TypeScript, Tailwind CSS, and Jotai for state management. Use when building UI components for the flight search application.
argument-hint: "[ComponentName e.g. SearchForm or FlightCard]"
---

Create a new React component named `$ARGUMENTS` in `frontend/src/components/$ARGUMENTS/`.

## Directory Structure

Every component is a self-contained directory:

```
frontend/src/components/$ARGUMENTS/
├── index.ts              # Public barrel export
├── $ARGUMENTS.tsx        # Main component implementation
├── types.ts              # TypeScript interfaces and types
├── constants.ts          # Component-specific constants
├── styles.ts             # Tailwind class name maps and style utilities
├── atoms.ts              # Jotai atoms for component state
└── hooks/
    └── use$ARGUMENTS.ts  # Custom hook(s) for component logic
```

Only create files that the component actually needs — `index.ts`, the component `.tsx`, and `types.ts` are always required. The rest are optional.

## Conventions

- TypeScript with explicit prop types (use `interface` for props, defined in `types.ts`)
- Tailwind CSS for all styling — no CSS modules, no styled-components
- Jotai for shared/global state — use atoms instead of React Context or prop drilling
- Use `"use client"` directive only when the component needs client-side interactivity
- Named exports only — no default exports
- Barrel export from `index.ts` for clean imports: `import { $ARGUMENTS } from "@/components/$ARGUMENTS"`

## File Templates

### index.ts — Barrel export
```typescript
export { $ARGUMENTS } from "./$ARGUMENTS";
export type { ${ARGUMENTS}Props } from "./types";
```

### types.ts — Interfaces and types
```typescript
export interface ${ARGUMENTS}Props {
  // Define props
}

// Additional types used by hooks, atoms, or the component
```

### $ARGUMENTS.tsx — Component
```tsx
"use client"; // Only if needed

import type { ${ARGUMENTS}Props } from "./types";

export function $ARGUMENTS({ ...props }: ${ARGUMENTS}Props) {
  return (
    <div>
      {/* Implementation */}
    </div>
  );
}
```

### constants.ts — Constants (optional)
```typescript
export const ${ARGUMENTS}_CONFIG = {
  // Component-specific config values
} as const;
```

### styles.ts — Tailwind class maps (optional)
```typescript
export const styles = {
  container: "flex flex-col gap-4",
  // Group related Tailwind classes by element/variant
} as const;
```

### atoms.ts — Jotai atoms (optional)
```typescript
import { atom } from "jotai";

// Primitive atoms
export const someValueAtom = atom<string>("");

// Derived/computed atoms
export const derivedAtom = atom((get) => {
  const value = get(someValueAtom);
  return value.toUpperCase();
});

// Write-only / async atoms
export const asyncActionAtom = atom(null, async (get, set) => {
  // Side-effect logic
});
```

### hooks/use$ARGUMENTS.ts — Custom hook (optional)
```typescript
import { useAtom } from "jotai";
import { someValueAtom } from "../atoms";

export function use$ARGUMENTS() {
  const [value, setValue] = useAtom(someValueAtom);

  // Hook logic

  return { value, setValue };
}
```

## Component Patterns

- **Forms**: Use controlled inputs, validate with Zod schemas, store form state in Jotai atoms if shared
- **Data display**: Accept typed data props, handle loading/empty/error states
- **Streaming**: Use custom hooks that consume `ReadableStream` from API routes
- **WebSocket**: Use `useEffect` for connection lifecycle, clean up on unmount
- **Global state**: Use Jotai atoms — prefer primitive atoms + derived atoms over large object atoms
- **Jotai Provider**: Not required for default store; only add `<Provider>` for isolated stores

## After creating

1. Verify TypeScript compiles without errors
2. Import and render the component in the appropriate page via barrel export
3. Handle loading, error, and empty states where applicable
4. Export atoms from `index.ts` if other components need access to the shared state
