# Keep Climbing

A browser-based, flight-themed trivia game framework for employee onboarding. Players steer a plane toward answer zones — correct answers climb higher, wrong answers descend. An altitude meter tracks progress across all questions.

## Project Structure

```
keep-climbing/
├── engine/                    # Game Engine (vanilla HTML/CSS/JS, static files)
│   ├── index.html             # Entry point
│   ├── css/
│   │   └── styles.css         # Game styles
│   ├── js/                    # JS modules (loaded via script tags)
│   │   ├── event-emitter.js
│   │   ├── i18n-manager.js
│   │   ├── config-manager.js
│   │   ├── question-loader.js
│   │   ├── game-state-machine.js
│   │   ├── game-logic.js
│   │   ├── persistence-manager.js
│   │   ├── audio-manager.js
│   │   ├── animation-manager.js
│   │   ├── accessibility-manager.js
│   │   ├── renderer.js
│   │   ├── input-manager.js
│   │   └── main.js
│   ├── lang/
│   │   └── en.json            # English UI strings
│   └── assets/
│       ├── images/            # Sprites, backgrounds
│       └── audio/             # SFX, background music
├── sample-questions.json      # Sample question file
├── generator/                 # Question Generator (Node.js CLI)
│   ├── package.json
│   └── src/
│       ├── cli.js             # CLI entry point
│       ├── file-parser.js     # PDF/PPTX text extraction
│       ├── llm-client.js      # LLM API integration
│       ├── question-validator.js
│       └── question-file-writer.js
└── README.md
```

## Game Engine

The engine runs entirely client-side with zero server dependencies. Serve the `engine/` folder from any static host or open `index.html` locally. It loads a JSON question file and manages the full game lifecycle.

### Quick Start

1. Open `engine/index.html` in a browser (or serve via any HTTP server)
2. The game loads `sample-questions.json` by default
3. Point to a different question file by passing its path to `KeepClimbing.init()`

## Question Generator

A Node.js CLI tool that accepts PDF/PPTX documents and uses LLM APIs to produce validated question files.

### Setup

```bash
cd generator
npm install
```

### Usage

```bash
node src/cli.js --input training.pdf --count 20 --output questions.json
```
