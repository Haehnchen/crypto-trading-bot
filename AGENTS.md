# AGENTS.md

This file provides guidance when working with code in this repository.

## Project Overview

A cryptocurrency trading bot supporting multiple exchanges via CCXT. Features multi-pair support, SQLite storage, web dashboard with basic authentication, and profile-based bot management.

## Key Build/Development Commands

### Development
```bash
npm install            # Install dependencies
npm run build:prod     # Production build with esbuild
npm start              # Build and run in production
```

### Testing & Code Quality

- Mocha test framework with tsx

```bash
npm test               # Run TypeScript tests with mocha
npm test:js            # Run JavaScript tests
npm run build:tsc      # Type-check with tsc (run before commits/CI)
```

### Build Tools

- **esbuild** (`npm run build`, `npm run build:prod`): Fast bundling/transpiling, no type-checking
- **tsc** (`npm run build:tsc`): Type-checking - run before commits to catch type errors

## Architecture Overview

### Main Entry Points
- **index.ts**: CLI entry point using Commander.js
    - `trade` command: Starts the trading bot and web server
    - Supports port override: `npm start -- --port=55555`

### Core Services (src/modules/services.ts)
Central service registry using dependency injection patterns:
- **Database**: SQLite with WAL mode, stored in `var/bot.db`
- **Config**: JSON configuration from `var/conf.json`

### Key Modules

#### Trading / Strategy System
- **Trade** (src/modules/trade.ts): Main orchestrator, starts BotRunner and webserver
- Built-in strategies: src/strategy/strategies/ and custom strategies in `var/strategies/` directory
- Profile Management: Each profile can have multiple bots with different strategies abd exchange credentials using CCXT
- OHLCV candles: fetched via Websocket, live or via backfill
- Indicator included via `talib` in `src/utils/indicators.ts

#### Web UI (Express.js + EJS) / Code Structure Conventions
- **Controllers** (src/controller/): Handle HTTP requests
- **Views** (views/): EJS templates with layout system `express-ejs-layouts`
- Tailwind CSS 4 for styling with "Font Awesome 7"
- `web/` webserver root with assets
- **Database** schema in `src/utils/database_schema.ts` with `src/repository` as Database Repository Pattern
- **.prettierrc**: Code formatting (single quotes, 160 width)
