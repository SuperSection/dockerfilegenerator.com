# Dockerfile Generator

A free, open-source online tool for generating production-ready Dockerfiles and Docker Compose files. Pick your stack, configure options, and get optimized Docker configurations in seconds.

**[Live Demo](https://dockerfilegenerator.soumosarkar.online/)** · **[Report Bug](https://github.com/SuperSection/dockerfilegenerator.com/issues)** · **[Request Feature](https://github.com/SuperSection/dockerfilegenerator.com/issues)**

## Features

- **23+ Framework Support** — Node.js, Express, NestJS, Next.js, React, Vue, Python, Django, FastAPI, Flask, Java, Spring Boot, Quarkus, Go, Rust, Actix, PHP, Laravel, Ruby on Rails, .NET, Phoenix, Gin
- **Multi-Stage Builds** — Smaller final images with build dependencies isolated to a builder stage
- **Best Practice Scanner** — Built-in auditor that flags security and performance issues (running as root, missing health checks, oversized base images)
- **Docker Compose Generator** — Visual multi-service orchestration with PostgreSQL, MySQL, MongoDB, Redis, Nginx, and more
- **Stack Builder** — Full-stack configuration with databases, caches, and reverse proxies
- **Framework-Specific Optimizations** — Spring Boot layered JARs, Next.js standalone output, FastAPI uvicorn tuning
- **Inline Explanations** — Every instruction explained in plain English as you generate
- **Export Options** — Download Dockerfile, .dockerignore, .env.example, or full zip package
- **Client-Side Generation** — No data leaves your browser; complete privacy
- **Free, No Signup** — Open source with no authentication required

## Tech Stack

- [Astro](https://astro.build/) — Static site generator and web framework
- [TypeScript](https://www.typescriptlang.org/) — Type-safe JavaScript
- [Tailwind CSS v4](https://tailwindcss.com/) — Utility-first CSS framework
- [Cloudflare Pages](https://pages.cloudflare.com/) — Deployment and hosting

## Getting Started

### Prerequisites

- Node.js >= 22.12.0
- npm

### Installation

```bash
git clone https://github.com/SuperSection/dockerfilegenerator.com.git
cd dockerfilegenerator.com
npm install
```

### Development

```bash
npm run dev
```

The dev server starts at `http://localhost:4321`.

### Production Build

```bash
npm run build
npm run preview
```

### Deploy

```bash
npm run deploy
```

This builds the site and deploys to Cloudflare Workers via Wrangler.

## Project Structure

```
/
├── public/                 # Static assets
├── src/
│   ├── components/         # Astro components (DockerfileGenerator, ComposeGenerator, StackBuilder, Nav, Footer, etc.)
│   ├── layouts/            # Page layouts
│   ├── lib/                # Utility functions and generators
│   ├── pages/              # Route pages (index, compose, stack-builder, about, contact, etc.)
│   ├── registry/           # Framework registry (provider configs, seeds, metadata)
│   ├── scripts/            # Build-time scripts
│   ├── styles/             # Global styles
│   └── types/              # TypeScript type definitions
├── scripts/                # CLI scripts (sync-registry)
├── astro.config.mjs        # Astro configuration
├── wrangler.jsonc           # Cloudflare Wrangler config
└── package.json
```

## How It Works

1. **Select a framework** from the supported list
2. **Configure options** — base image, port, package manager, multi-stage builds, security settings
3. **Generate** — get a production-ready Dockerfile with best practices baked in
4. **Review** — the scanner audits your Dockerfile and flags issues
5. **Export** — copy, download, or export as a zip package

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Author

**Soumo Sarkar** — [GitHub](https://github.com/SuperSection) · [Website](https://soumosarkar.online/)

## License

This project is open source. See the repository for license details.

---

Built for developers who ship.
