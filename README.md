# 🍌 BANANATOR

**Natural language → Optimized image prompts. Instantly.**

BANANATOR is a prompt engineering tool that transforms casual, everyday image descriptions into professionally structured, model-optimized prompts for Google's image generation models. Stop manually crafting the perfect prompt — just describe what you see in your head, and BANANATOR handles the rest.

---

## What It Does

BANANATOR takes your simple idea — like *"a cozy coffee shop in the rain at night"* — and runs it through a multi-step AI pipeline that:

1. **Analyzes** your description, reference images, and target model
2. **Asks smart questions** to fill in the gaps (style, mood, lighting, composition)
3. **Generates** a production-grade structured prompt tailored to your chosen model
4. **Lets you refine** the output with follow-up tweaks — all without starting over

The result is a detailed, copy-paste-ready prompt engineered specifically for the model you're targeting.

---

## Supported Models

| Model | Description |
|---|---|
| **Gemini 3.1 Flash Image** | Latest fast model. Supports 1K–4K, extreme aspect ratios, and search grounding. |
| **Gemini 3.0 Pro Image** | Highest quality & complex reasoning. Supports 1K–4K and web search grounding. |
| **Imagen 4** | Google's flagship text-to-image model. Excellent photorealism and text rendering. |
| **Gemini 2.5 Flash Image** | Standard fast generation model. Good for general purpose. |

---

## Features

- **Multi-model targeting** — Select the model and BANANATOR tailors the prompt structure accordingly
- **Reference image uploads** — Attach multiple reference images with annotations for visual context
- **Smart clarification** — AI asks 1–3 targeted questions to refine your vision before generating
- **Aspect ratio & resolution control** — Supports 1:1, 16:9, 9:16, 4:3, 3:4, 21:9, 9:21 and resolutions up to 4096×4096
- **Rules & constraints** — Set boundaries like "don't change facial features" or "keep background minimal"
- **Prompt refinement** — Tweak the generated prompt with natural language adjustments
- **Expert tips** — Each prompt comes with model-specific tips and best practices
- **Prompt history** — Last 20 prompts saved locally for quick access
- **Web search grounding** — Uses Google Search to verify artistic styles, technical terms, and model best practices

---

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** for dev/build
- **Tailwind CSS 4** for styling
- **Framer Motion** for animations
- **Gemini API** (`@google/genai`) with structured JSON output
- **Lucide React** for icons

---

## Getting Started

### Prerequisites

- Node.js (v18+)
- A [Gemini API key](https://aistudio.google.com/apikey)

### Installation

```bash
git clone https://github.com/ashakerkho/BANANATOR.git
cd BANANATOR
npm install
```

### Configuration

Create a `.env.local` file in the root directory:

```
GEMINI_API_KEY=your_gemini_api_key_here
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
```

---

## How It Works

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Your Idea  │────▶│  Smart Q&A   │────▶│  Final Prompt   │
│  + Images   │     │  (1-3 Qs)    │     │  + Expert Tips  │
│  + Rules    │     │  or skip     │     │  + Refinement   │
└─────────────┘     └──────────────┘     └─────────────────┘
     STEP 1              STEP 2               STEP 3
```

BANANATOR uses **Gemini 3.1 Pro** as its reasoning backbone to analyze your input, generate clarifying questions, and craft the final prompt — all with structured JSON output and web search grounding for accuracy.

---

## License

MIT

---

## Author

Built by [@ashakerkho](https://github.com/ashakerkho)
