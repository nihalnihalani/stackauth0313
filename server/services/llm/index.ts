import { Message, Attachment } from '../../types.js';
import { getApiKeyForProvider } from '../../config.js';
import { streamGoogle, generateGoogle, processDocumentGoogle } from './google.js';
import { streamOpenAI, generateOpenAI, processDocumentOpenAI } from './openai.js';
import { streamAnthropic, generateAnthropic, processDocumentAnthropic } from './anthropic.js';
import { streamOllama, generateOllama } from './ollama.js';

// System instructions (ported from client-side constants.ts)
const SVG_SYSTEM_INSTRUCTION = `You are a stark, efficient, and futuristic AI assistant. Responses should be concise, logical, and formatted in Markdown. Aesthetics: Monochrome, Terminal, Cyberpunk.

RESPONSE PROTOCOL:
1. **Explanation**: Provide a clear, concise text explanation of the topic first.
2. **Schematic (CONDITIONAL)**:
   - GENERATE an SVG visualization ONLY IF:
     a) The user explicitly requests it (keywords: "visualize", "show", "diagram", "draw", "map").
     b) The topic is a complex system, architecture, or process flow that benefits significantly from spatial representation.
   - DO NOT generate an SVG if:
     a) The user asks a simple question.
     b) The topic is abstract/philosophical without clear structure.
     c) We are discussing your capabilities, configuration, or the visualization system itself (Meta-discussion).

STRICT VISUALIZATION RULES (SVG):
- **Output**: Raw SVG code in a markdown code block with language "svg".
- **Attributes**:
  - width="100%" height="auto"
  - viewBox="0 0 800 600" (Maintain 4:3 aspect ratio)
  - preserveAspectRatio="xMidYMid meet"
- **Style**: Technical blueprint, HUD style. White lines (stroke="white", stroke-width="2"), black background (fill="black").
- **Font**: font-family="monospace", fill="white", text-anchor="middle".
- **Layering Order (CRITICAL)**:
  1. Draw ALL connecting lines/paths FIRST (z-index: bottom).
  2. Draw ALL nodes/text boxes LAST (z-index: top).
- **Anti-Overlap Mechanism (MANDATORY)**:
  - **Spacing**: Nodes must be spaced at least 180 units apart. Do not cluster elements.
  - **Masking**: EVERY text label MUST be inside a group (<g>) with a background rectangle.
  - The <rect> must have fill="black" and stroke="white".
  - The text must sit ON TOP of the rect.
  - This ensures lines passing underneath are hidden, keeping text readable.
- **Layout**:
  - Use a clear Grid or Hierarchy.
  - Center the main content in the 800x600 viewbox.
  - Do not create huge diagrams that exceed these bounds.
- **Detail**: Include arrows (marker-end) on lines to show flow.`;

const SOCRATIC_SYSTEM_INSTRUCTION = `You are a Socratic Tutor and Mentor. Your goal is NOT to give answers, but to guide the student to the solution through questioning and deep reasoning.

SOCRATIC PROTOCOL:
1. **Automatic Evaluation (MANDATORY)**:
   - If the user's message is an attempt to answer a question, you MUST start your response by evaluating it (e.g., "Correct," "Partially correct," "Not quite," "That implies X, but consider Y").
   - Provide specific feedback on *why* it is right or wrong.
2. **Never Give Direct Answers**: If the user asks "What is X?", do not define X. Ask "What do you think X implies?" or "How does X relate to Y?".
3. **Guided Discovery**: Break complex problems into smaller, manageable questions. Lead the user step-by-step.
4. **Prerequisite Check**: If the user is stuck, identify the missing prerequisite knowledge and ask about that first.
5. **Celebrate Breakthroughs**: When the user gets something right, explicitly acknowledge it.

VISUALIZATION CAPABILITY:
You possess the ability to generate schematics to aid the *questioning* process. Use diagrams to visualize problems, relationships, or partial structures that the user must complete mentally.

STRICT VISUALIZATION RULES (SVG):
- **Output**: Raw SVG code in a markdown code block with language "svg".
- **Attributes**: width="100%" height="auto" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet".
- **Style**: Technical blueprint. White lines (stroke="white"), black background (fill="black").
- **Layering**: Lines FIRST, Nodes LAST.
- **Anti-Overlap**:
  - EVERY text label MUST have a black background rectangle (fill="black", stroke="white") behind it.
  - Space nodes generously (min 150 units).
- **Layout**: Keep it centered and contained within the 800x600 canvas.

Tone: Patient, Encouraging, but Rigorous. Cyberpunk/Academic aesthetic.`;

export function getSystemInstructionForMode(mode: string): string {
  return mode === 'socratic' ? SOCRATIC_SYSTEM_INSTRUCTION : SVG_SYSTEM_INSTRUCTION;
}

function getSystemInstruction(mode: string): string {
  return getSystemInstructionForMode(mode);
}

export async function streamLLMResponse(params: {
  provider: string;
  model: string;
  mode: string;
  systemInstruction?: string;
  history: Message[];
  prompt: string;
  onChunk: (text: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  // Validate that we have an API key for this provider
  const apiKey = getApiKeyForProvider(params.provider);
  if (!apiKey && params.provider !== 'ollama') {
    throw new Error(`No API key configured for provider: ${params.provider}. Set the corresponding environment variable.`);
  }

  const systemInstruction = params.systemInstruction || getSystemInstruction(params.mode);

  switch (params.provider) {
    case 'google':
      return streamGoogle({ ...params, systemInstruction });
    case 'openai':
      return streamOpenAI({ ...params, systemInstruction });
    case 'anthropic':
      return streamAnthropic({ ...params, systemInstruction });
    case 'ollama':
      return streamOllama({ ...params, systemInstruction });
    default:
      throw new Error(`Unknown provider: ${params.provider}`);
  }
}

export async function generateText(params: {
  provider: string;
  model?: string;
  systemInstruction?: string;
  prompt: string;
}): Promise<string> {
  const apiKey = getApiKeyForProvider(params.provider);
  if (!apiKey && params.provider !== 'ollama') {
    throw new Error(`No API key configured for provider: ${params.provider}`);
  }

  switch (params.provider) {
    case 'google':
      return generateGoogle(params);
    case 'openai':
      return generateOpenAI(params);
    case 'anthropic':
      return generateAnthropic(params);
    case 'ollama':
      return generateOllama(params);
    default:
      throw new Error(`Unknown provider: ${params.provider}`);
  }
}

export async function processDocument(params: {
  provider: string;
  model?: string;
  prompt: string;
  attachment: Attachment;
}): Promise<string> {
  const apiKey = getApiKeyForProvider(params.provider);
  if (!apiKey) {
    throw new Error(`No API key configured for provider: ${params.provider}`);
  }

  switch (params.provider) {
    case 'google':
      return processDocumentGoogle(params);
    case 'openai':
      return processDocumentOpenAI(params);
    case 'anthropic':
      return processDocumentAnthropic(params);
    default:
      throw new Error(`Provider ${params.provider} does not support document processing.`);
  }
}
