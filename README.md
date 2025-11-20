# One Stack

A modern, production-ready full-stack monorepo template with best-in-class developer experience and tooling.

## Tech Stack

### Core
- **[pnpm](https://pnpm.io/)** - Fast, disk space efficient package manager
- **[Turborepo](https://turbo.build/)** - High-performance build system for monorepos
- **[Next.js 15](https://nextjs.org/)** - React framework for production
- **[TypeScript](https://www.typescriptlang.org/)** - Typed JavaScript at scale
- **[Prisma](https://www.prisma.io/)** - Next-generation ORM for Node.js and TypeScript

### UI & Styling
- **[shadcn/ui](https://ui.shadcn.com/)** - Beautifully designed components
- **[Radix UI](https://www.radix-ui.com/)** - Unstyled, accessible components
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[Lucide Icons](https://lucide.dev/)** - Beautiful & consistent icons

### Code Quality
- **[Biome](https://biomejs.dev/)** - Fast formatter and linter for JavaScript and TypeScript
- **[Sherif](https://github.com/QuiiBz/sherif)** - Monorepo dependency management validation
- **[Husky](https://typicode.github.io/husky/)** - Git hooks for quality enforcement
- **[lint-staged](https://github.com/lint-staged/lint-staged)** - Run linters on staged files

### CI/CD
- **GitHub Actions** - Automated testing and validation on every push/PR

## Project Structure

```
one-stack/
├── apps/
│   └── web/              # Next.js application
│       ├── src/
│       │   ├── app/      # App router pages
│       │   ├── components/
│       │   │   └── ui/   # shadcn/ui components
│       │   └── lib/      # Utilities
│       └── package.json
├── packages/
│   ├── database/         # Prisma schema and client
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── src/
│   │       └── index.ts  # Prisma client export
│   └── ui/               # Shared UI components
│       └── src/
│           ├── index.ts  # Component exports
│           └── utils.ts  # Shared utilities (cn)
├── .github/
│   └── workflows/
│       └── ci.yml        # CI/CD pipeline
├── .husky/               # Git hooks
│   ├── pre-commit        # Runs lint-staged + sherif
│   └── pre-push          # Runs typecheck + lint
├── turbo.json            # Turborepo configuration
├── biome.json            # Biome configuration
├── pnpm-workspace.yaml   # pnpm workspace config
└── package.json          # Root package.json
```

## Getting Started

### Prerequisites

- **Node.js** 20 or higher
- **pnpm** 10.22.0 (installed automatically via `packageManager` field)

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp packages/database/.env.example packages/database/.env
# Edit packages/database/.env with your database URL
```

### Development

```bash
# Start all apps and packages in development mode
pnpm dev

# Start only the web app
pnpm --filter web dev

# Open Prisma Studio (database GUI)
pnpm db:studio
```

The web app will be available at `http://localhost:3000`

## Available Scripts

### Development
- `pnpm dev` - Start all apps in development mode
- `pnpm build` - Build all apps and packages
- `pnpm typecheck` - Run TypeScript type checking across all packages
- `pnpm lint` - Lint all packages
- `pnpm format` - Format code with Biome
- `pnpm check` - Lint and auto-fix with Biome

### Database
- `pnpm db:generate` - Generate Prisma Client
- `pnpm db:push` - Push schema changes to database
- `pnpm db:studio` - Open Prisma Studio

### Code Quality
- `pnpm sherif` - Validate dependency versions across workspace

### CI
- `pnpm ci` - Run the full CI pipeline locally (sherif + typecheck + lint + build)

## Workspace Packages

### `apps/web`
Next.js 15 application with:
- App Router
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Hot reload

### `packages/ui`
Shared UI component library with:
- Utility functions (`cn` for className merging)
- Shared component exports
- Tailwind + class-variance-authority integration
- React 18/19 peer dependency support

### `packages/database`
Prisma database layer with:
- Type-safe database client
- PostgreSQL schema (User & Post models)
- Automatic Prisma Client generation
- Database migrations support

## Development Workflow

### Making Changes

1. Create a new branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Commit your changes (Husky will run pre-commit checks)
4. Push your changes (Husky will run pre-push checks)
5. Create a pull request

### Git Hooks

#### Pre-commit
Runs automatically on `git commit`:
- **lint-staged** - Lints and formats only staged files
- **sherif** - Validates dependency versions

#### Pre-push
Runs automatically on `git push`:
- **typecheck** - Full TypeScript type checking
- **lint** - Full lint check across all packages

### CI/CD Pipeline

Every push and pull request triggers the CI pipeline:

1. Install dependencies with cache
2. Run Sherif (dependency validation)
3. Run type checking
4. Run linting
5. Build all packages

## Adding New Packages

### Add a New App

```bash
# Create new app directory
mkdir -p apps/my-app
cd apps/my-app

# Initialize package.json
pnpm init

# Install from workspace root
cd ../..
pnpm install
```

### Add a New Package

```bash
# Create new package directory
mkdir -p packages/my-package
cd packages/my-package

# Initialize package.json
pnpm init

# Install from workspace root
cd ../..
pnpm install
```

## Environment Variables

### Database Package
Create `packages/database/.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
```

### Web App (if needed)
Create `apps/web/.env.local`:
```env
# Add your environment variables here
```

## Troubleshooting

### Prisma Client not found
```bash
pnpm db:generate
```

### Dependency version mismatches
```bash
pnpm sherif
# Fix any reported version mismatches in package.json files
```

### Build cache issues
```bash
# Clear Turbo cache
rm -rf .turbo

# Clear Next.js cache
rm -rf apps/web/.next
```

### Git hooks not running
```bash
# Reinstall Husky
pnpm prepare
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes (follow conventional commits)
4. Push to the branch
5. Open a Pull Request

## License

MIT

---

Built with ❤️ using modern web technologies
