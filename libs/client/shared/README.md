# @lib/client-shared

This library contains shared utilities and logic for client-side applications in the Nx workspace.

## Purpose

The `client/shared` folder holds common utility functions, helpers, and logic that can be reused across all client-side applications (e.g., React apps, Vue apps, etc.).

## Structure

```
src/
  ├── index.ts          # Main entry point for the library
  └── ...               # Additional shared utility files
```

## Usage

Import shared utilities from your client applications:

```typescript
import { someSharedFunction } from '@lib/client-shared';
```

## Available Utilities

- **Formatters**: Date, currency, and other common formatters
- **Validators**: Client-side validation helpers
- **HTTP Helpers**: Utility functions for API calls
- **State Management**: Shared Redux/Context providers and hooks
- **DOM Helpers**: CSS-in-JS utilities and DOM manipulation helpers

## TypeScript Configuration

This library is configured with strict TypeScript settings to ensure type safety across all client applications.

## Testing

Run tests for this library:

```bash
nx test client-shared
```

## License

MIT