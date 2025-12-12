# ClaudeWork

AI-powered development workspace with Next.js integration.

## Getting Started

First, install dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

```
claude-work/
├── src/
│   ├── app/          # Next.js App Router pages
│   ├── services/     # Business logic and external services
│   ├── lib/          # Utility functions and helpers
│   └── bin/          # CLI entry point
├── docs/             # Documentation
└── package.json
```

## CLI Usage

```bash
npx claude-work
```

## Technologies

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- React 18

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
