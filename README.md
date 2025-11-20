# One Stack

A modern full-stack monorepo template using:

- **[Turborepo](https://turbo.build/)** - High-performance build system for monorepos
- **[shadcn/ui](https://ui.shadcn.com/)** - Beautifully designed components built with Radix UI and Tailwind CSS
- **[Prisma](https://www.prisma.io/)** - Next-generation ORM for Node.js and TypeScript
- **[Biome](https://biomejs.dev/)** - Fast formatter and linter for JavaScript and TypeScript

## Getting Started

### Prerequisites

- Node.js 20 or higher
- npm 10 or higher

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Building

```bash
npm run build
```

### Linting & Formatting

```bash
# Format code
npm run format

# Lint and fix
npm run check
```

### Database

```bash
# Generate Prisma Client
npm run db:generate

# Push schema changes to database
npm run db:push

# Open Prisma Studio
npm run db:studio
```

## Project Structure

```
one-stack/
├── apps/
│   └── web/          # Next.js application with shadcn/ui
├── packages/
│   ├── database/     # Prisma schema and client
│   └── ui/           # Shared UI components
├── turbo.json        # Turborepo configuration
└── package.json      # Root package.json
```
