import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { streamLLMResponse, generateText, processDocument } from '../services/llm/index.js';
import {
  GenerateTitleRequest,
  GenerateSyllabusRequest,
  GenerateAssessmentRequest,
  ProcessDocumentRequest,
} from '../types.js';

export const generateRouter = Router();

// --- Generate Title (non-streaming) ---
generateRouter.post('/generate-title', requireAuth, async (req: Request, res: Response) => {
  const body = req.body as GenerateTitleRequest;

  if (!body.provider || !body.content) {
    res.status(400).json({ error: 'Missing required fields: provider, content' });
    return;
  }

  const prompt = `Generate a very concise title (3-5 words maximum) for the following text. Do not use quotes or markdown. Text: ${body.content.substring(0, 500)}`;

  try {
    const title = await generateText({
      provider: body.provider,
      model: body.model,
      prompt,
    });
    res.json({ title: title.trim() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(502).json({ error: `Title generation failed: ${message}` });
  }
});

// --- Generate Syllabus (streaming) ---
generateRouter.post('/generate-syllabus', requireAuth, async (req: Request, res: Response) => {
  const body = req.body as GenerateSyllabusRequest;

  if (!body.provider || !body.notes) {
    res.status(400).json({ error: 'Missing required fields: provider, notes' });
    return;
  }

  if (body.notes.length === 0) {
    res.json({ content: JSON.stringify({ title: 'Empty Archives', modules: [] }) });
    return;
  }

  const notesList = body.notes
    .map(n => `- Title: ${n.title}\n  Excerpt: ${n.content.substring(0, 100)}...`)
    .join('\n');

  let prompt = '';
  if (body.currentSyllabusJson) {
    prompt = `
      You are a Curriculum Architect.
      You have an EXISTING Syllabus Structure and a list of student notes (some might be new).

      YOUR TASK: Update the syllabus to include any NEW concepts from the notes.

      RULES:
      1. PRESERVE the existing structure (Modules/Topics) as much as possible. Do not rename or delete existing modules unless strictly necessary.
      2. ONLY ADD new topics or subtopics found in the notes that are missing.
      3. OUTPUT THE COMPLETE, MERGED JSON STRUCTURE. Do not return a diff.
      4. Do not use Markdown formatting (no \`\`\`json). Just the raw JSON object.

      Existing Syllabus:
      ${body.currentSyllabusJson}

      All Notes:
      ${notesList}
    `;
  } else {
    prompt = `
      You are a Curriculum Architect.
      Analyze the following list of student notes and organize them into a structured Study Syllabus.

      CRITICAL: Output ONLY valid JSON. Do not use Markdown formatting (no \`\`\`json). Do not include intro text.

      Structure the JSON as follows:
      {
        "title": "Course Title Based on Content",
        "modules": [
          {
            "title": "Module Name (High Level Theme)",
            "topics": [
              {
                "title": "Topic Name",
                "subtopics": ["Detail 1", "Detail 2", "Specific Note Reference"]
              }
            ]
          }
        ]
      }

      Notes Data:
      ${notesList}
    `;
  }

  // Set SSE headers for streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    await streamLLMResponse({
      provider: body.provider,
      model: body.model || '',
      mode: 'direct',
      systemInstruction: 'You are an expert academic curriculum designer. You speak only JSON.',
      history: [],
      prompt,
      onChunk: (text) => {
        if (!controller.signal.aborted) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      },
      signal: controller.signal,
    });

    if (!controller.signal.aborted) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (error) {
    if (!controller.signal.aborted) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  }
});

// --- Generate Assessment (streaming) ---
generateRouter.post('/generate-assessment', requireAuth, async (req: Request, res: Response) => {
  const body = req.body as GenerateAssessmentRequest;

  if (!body.provider || !body.topic) {
    res.status(400).json({ error: 'Missing required fields: provider, topic' });
    return;
  }

  const relevantNotes = (body.notes || [])
    .filter(n =>
      n.title.toLowerCase().includes(body.topic.toLowerCase()) ||
      n.content.toLowerCase().includes(body.topic.toLowerCase())
    )
    .slice(0, 5)
    .map(n => `- ${n.title}: ${n.content.substring(0, 200)}...`)
    .join('\n');

  const prompt = `
    You are a Professor creating a quiz.
    Topic: "${body.topic}"
    Context from Student Notes:
    ${relevantNotes}

    Task: Generate 5 Multiple Choice Questions (MCQs) to test understanding of this topic.

    CRITICAL: Output ONLY valid JSON. No markdown. No intro.

    JSON Format:
    [
      {
        "id": 1,
        "question": "Question text here?",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctAnswerIndex": 0,
        "explanation": "Brief explanation why this is correct."
      }
    ]
  `;

  // Set SSE headers for streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    await streamLLMResponse({
      provider: body.provider,
      model: body.model || '',
      mode: 'direct',
      systemInstruction: 'You are an expert examiner. You output strictly valid JSON arrays of questions.',
      history: [],
      prompt,
      onChunk: (text) => {
        if (!controller.signal.aborted) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      },
      signal: controller.signal,
    });

    if (!controller.signal.aborted) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (error) {
    if (!controller.signal.aborted) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  }
});

// --- Process Document (non-streaming) ---
generateRouter.post('/process-document', requireAuth, async (req: Request, res: Response) => {
  const body = req.body as ProcessDocumentRequest;

  if (!body.provider || !body.attachment) {
    res.status(400).json({ error: 'Missing required fields: provider, attachment' });
    return;
  }

  const prompt = `
    Analyze the attached document/image.
    1. EXTRACT the full text content, formatting it nicely in Markdown. Preserve headers, lists, and structure.
    2. GENERATE a concise title (max 5 words) based on the content.

    CRITICAL: Output ONLY valid JSON in this format:
    {
      "title": "Document Title",
      "content": "# Extracted Content\\n\\n..."
    }
  `;

  try {
    const responseText = await processDocument({
      provider: body.provider,
      model: body.model,
      prompt,
      attachment: body.attachment,
    });

    // Parse the JSON response from the LLM
    try {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        res.json(JSON.parse(match[0]));
      } else {
        res.json(JSON.parse(responseText));
      }
    } catch (e) {
      // Fallback if JSON parsing fails
      res.json({ title: 'Extracted Document', content: responseText });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(502).json({ error: `Document processing failed: ${message}` });
  }
});
