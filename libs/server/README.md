# Server Libraries

This directory contains all server-side logic and utilities for the Nx workspace.

## Purpose

The `libs/server` folder holds all server-side logic including authentication, data access layers, user management middleware, and shared utilities specifically for server-side operations.

## Structure

```
server/
├── auth/                    # Server-side authentication logic
│   ├── strategies/          # Authentication strategies (JWT, OAuth, etc.)
│   ├── guards/             # Permission guards and decorators
│   └── providers/          # Auth providers and configurations
├── data-access/            # Prisma and other data access layers
│   ├── prisma/             # Database schema and migrations
│   ├── repositories/       # Data access repository patterns
│   └── models/             # Data models and entities
├── user/                   # Server-side logic for logged-in users
│   ├── middleware/         # NESTJS middleware to get @LoggedInUser(user: LoggedInUser)
│   ├── decorators/         # User context decorators
│   ├── interceptors/       # Request/response interceptors
│   └── services/           # User-related business logic
├── shared/                 # Logic shared between different server libs
│   ├── utils/              # Shared utility functions
│   ├── constants/          # Server-side constants and configs
│   └── pipes/              # Validation pipes and filters
└── index.ts                # Main entry point for all server libraries
```

## Usage Examples

### Authentication Middleware

```typescript
// Use the auth middleware to get current user context
import { LoggerinUser } from '@lib/server-auth';

@UseGuards(LoggerinUser)
@Controller('users')
export class UsersController {
  @Get()
  findAll(@LoggedInUser() user: LoggedInUser) {
    return this.userService.findAll(user.id);
  }
}
```

### Data Access Layer

```typescript
// Use Prisma data access layer
import { UserRepository } from '@lib/server-data-access';

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}
  
  async findAll(userId: string) {
    return this.userRepository.findAll();
  }
}
```

### Shared Utilities

```typescript
// Import shared utilities between server libs
import { logger, formatDate } from '@lib/server-shared';

logger.info('Server started');
const formatted = formatDate(new Date());
```

## Available Libraries

- **@lib/server-auth**: Authentication guards, strategies, and middleware
- **@lib/server-data-access**: Prisma client, repositories, and data access logic  
- **@lib/server-user**: User context middleware, decorators, and interceptors
- **@lib/server-shared**: Shared utilities and constants for server-side code

## Best Practices

1. Keep authentication logic isolated in `auth/`
2. Use dependency injection for data access repositories
3. Implement user context via the provided middleware pattern
4. Share common utilities through `server/shared/`
5. Always validate input using Zod schemas from `shared/validation-schemas`

## Testing

Run tests for server libraries:

```bash
nx test server-auth
nx test server-data-access
nx test server-user
nx test server-shared
```

## License

MIT


---

## Related Libraries

- **@lib/shared-validation-schemas**: Zod schemas used for validation
- **@lib/shared-dto**: TypeScript DTOs backed by Zod schemas
- **@lib/shared-types**: Shared TypeScript types and interfaces