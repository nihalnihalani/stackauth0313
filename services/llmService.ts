
import { GoogleGenAI } from "@google/genai";
import { MODELS, PROVIDERS, SVG_SYSTEM_INSTRUCTION, SOCRATIC_SYSTEM_INSTRUCTION, MODES } from '../constants';
import { Message, AppConfig, Note, Attachment } from '../types';

export const streamResponse = async (
  config: AppConfig,
  history: Message[],
  prompt: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal
) => {
  switch (config.provider) {
    case PROVIDERS.OPENAI:
      await callOpenAI(config, history, prompt, onChunk, signal);
      break;
    case PROVIDERS.ANTHROPIC:
      await callAnthropic(config, history, prompt, onChunk, signal);
      break;
    case PROVIDERS.OLLAMA:
      await callOllama(config, history, prompt, onChunk, signal);
      break;
    case PROVIDERS.GOOGLE:
    default:
      await callGoogle(config, history, prompt, onChunk, signal);
      break;
  }
};

export const processDocument = async (config: AppConfig, attachment: Attachment): Promise<{ title: string, content: string }> => {
  const prompt = `
    Analyze the attached document/image.
    1. EXTRACT the full text content, formatting it nicely in Markdown. Preserve headers, lists, and structure.
    2. GENERATE a concise title (max 5 words) based on the content.
    
    CRITICAL: Output ONLY valid JSON in this format:
    {
      "title": "Document Title",
      "content": "# Extracted Content\n\n..."
    }
  `;

  // Helper to extract JSON from response
  const parseResponse = (text: string) => {
    try {
      // Find JSON block
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      return JSON.parse(text);
    } catch (e) {
      // Fallback
      return { title: "Extracted Document", content: text };
    }
  };

  // Switch based on provider
  if (config.provider === PROVIDERS.GOOGLE) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: config.model || MODELS.FAST,
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: attachment.mimeType, data: attachment.data } }
        ]
      },
      config: { responseMimeType: "application/json" }
    });
    return parseResponse(response.text || '');
  } 
  
  if (config.provider === PROVIDERS.ANTHROPIC) {
    // Anthropic supports PDF and Image in messages
    const content: any[] = [];
    if (attachment.type === 'image') {
       content.push({ type: "image", source: { type: "base64", media_type: attachment.mimeType, data: attachment.data } });
    } else {
       // Anthropic PDF (Beta) - often requires specific handling or converting to image for stability in some SDKs,
       // but here we can try the document block if valid, otherwise fallback.
       content.push({ 
           type: "document", 
           source: { type: "base64", media_type: attachment.mimeType, data: attachment.data } 
       });
    }
    content.push({ type: "text", text: prompt });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerously-allow-browser': 'true'
      },
      body: JSON.stringify({
        model: config.model || 'claude-3-5-sonnet-20240620',
        max_tokens: 4096,
        messages: [{ role: 'user', content: content }]
      })
    });
    const json = await response.json();
    return parseResponse(json.content?.[0]?.text || '');
  }

  // Fallback for OpenAI (Image only) or others
  if (attachment.type === 'image' && config.provider === PROVIDERS.OPENAI) {
     const response = await fetch(`${config.baseUrl || 'https://api.openai.com/v1'}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model || 'gpt-4o',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${attachment.mimeType};base64,${attachment.data}` } }
            ]
          }]
        })
      });
      const json = await response.json();
      return parseResponse(json.choices?.[0]?.message?.content || '');
  }

  throw new Error("Provider does not support this file type for extraction. Please use Google Gemini.");
};

export const generateTitle = async (config: AppConfig, content: string): Promise<string> => {
  const prompt = `Generate a very concise title (3-5 words maximum) for the following text. Do not use quotes or markdown. Text: ${content.substring(0, 500)}`;
  
  let fullText = "";
  const onChunk = (text: string) => { fullText += text; };

  const fastConfig = { ...config };
  if (config.provider === PROVIDERS.GOOGLE) {
    fastConfig.model = MODELS.FAST;
  }

  try {
    switch (config.provider) {
      case PROVIDERS.OPENAI:
        await callOpenAI(fastConfig, [], prompt, onChunk);
        break;
      case PROVIDERS.ANTHROPIC:
        await callAnthropic(fastConfig, [], prompt, onChunk);
        break;
      case PROVIDERS.OLLAMA:
        await callOllama(fastConfig, [], prompt, onChunk);
        break;
      case PROVIDERS.GOOGLE:
      default:
        await callGoogle(fastConfig, [], prompt, onChunk);
        break;
    }
    return fullText.trim();
  } catch (e) {
    console.error("Title generation failed", e);
    return "Saved Note";
  }
};

export const generateSyllabus = async (config: AppConfig, notes: Note[], onChunk: (text: string) => void, currentSyllabusJson?: string) => {
  if (notes.length === 0) {
    onChunk(JSON.stringify({ title: "Empty Archives", modules: [] }));
    return;
  }

  const notesList = notes.map(n => `- Title: ${n.title}\n  Excerpt: ${n.content.substring(0, 100)}...`).join('\n');
  
  let prompt = '';

  if (currentSyllabusJson) {
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
        ${currentSyllabusJson}
        
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

  const syllabusConfig = { ...config, systemInstruction: "You are an expert academic curriculum designer. You speak only JSON." };
  
  if (config.provider === PROVIDERS.GOOGLE) {
    syllabusConfig.model = MODELS.FAST;
  }
  
  switch (config.provider) {
    case PROVIDERS.OPENAI:
      await callOpenAI(syllabusConfig, [], prompt, onChunk);
      break;
    case PROVIDERS.ANTHROPIC:
      await callAnthropic(syllabusConfig, [], prompt, onChunk);
      break;
    case PROVIDERS.OLLAMA:
      await callOllama(syllabusConfig, [], prompt, onChunk);
      break;
    case PROVIDERS.GOOGLE:
    default:
      await callGoogle(syllabusConfig, [], prompt, onChunk);
      break;
  }
};

export const generateAssessment = async (config: AppConfig, topic: string, notes: Note[], onChunk: (text: string) => void) => {
  const relevantNotes = notes
    .filter(n => 
      n.title.toLowerCase().includes(topic.toLowerCase()) || 
      n.content.toLowerCase().includes(topic.toLowerCase())
    )
    .slice(0, 5)
    .map(n => `- ${n.title}: ${n.content.substring(0, 200)}...`)
    .join('\n');

  const prompt = `
    You are a Professor creating a quiz.
    Topic: "${topic}"
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

  const quizConfig = { ...config, systemInstruction: "You are an expert examiner. You output strictly valid JSON arrays of questions." };
  
  if (config.provider === PROVIDERS.GOOGLE) {
    quizConfig.model = MODELS.FAST;
  }

  switch (config.provider) {
    case PROVIDERS.OPENAI:
      await callOpenAI(quizConfig, [], prompt, onChunk);
      break;
    case PROVIDERS.ANTHROPIC:
      await callAnthropic(quizConfig, [], prompt, onChunk);
      break;
    case PROVIDERS.OLLAMA:
      await callOllama(quizConfig, [], prompt, onChunk);
      break;
    case PROVIDERS.GOOGLE:
    default:
      await callGoogle(quizConfig, [], prompt, onChunk);
      break;
  }
};

const processStream = async (response: Response, onLine: (line: string) => void) => {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) return;

  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.trim()) onLine(line.trim());
    }
  }
  if (buffer.trim()) onLine(buffer.trim());
};

const getSystemInstruction = (config: AppConfig) => {
  return config.mode === MODES.SOCRATIC ? SOCRATIC_SYSTEM_INSTRUCTION : SVG_SYSTEM_INSTRUCTION;
};

const callGoogle = async (config: AppConfig, history: Message[], prompt: string, onChunk: (text: string) => void, signal?: AbortSignal) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let previousHistory = history;
  let currentAttachments: Attachment[] | undefined;

  if (history.length > 0) {
      const lastMsg = history[history.length - 1];
      if (lastMsg.role === 'user') {
          previousHistory = history.slice(0, -1);
          currentAttachments = lastMsg.attachments;
      }
  }

  const chatSession = ai.chats.create({
    model: config.model || MODELS.THINKING,
    config: { systemInstruction: getSystemInstruction(config) },
    history: previousHistory.filter(m => m.role !== 'system').map(m => {
       const parts: any[] = [{ text: m.text }];
       if (m.attachments) {
         m.attachments.forEach(att => {
           parts.push({
             inlineData: {
               mimeType: att.mimeType,
               data: att.data
             }
           });
         });
       }
       return { role: m.role, parts };
    })
  });

  const parts: any[] = [{ text: prompt }];
  if (currentAttachments) {
    currentAttachments.forEach(att => {
      parts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: att.data
        }
      });
    });
  }

  // Google GenAI iterator does not take signal directly in sendMessageStream types for this SDK wrapper usually,
  // but we can break the loop.
  const result = await chatSession.sendMessageStream({ message: parts });
  
  for await (const chunk of result) {
    if (signal?.aborted) break;
    if (chunk.text) onChunk(chunk.text);
  }
};

const callOpenAI = async (config: AppConfig, history: Message[], prompt: string, onChunk: (text: string) => void, signal?: AbortSignal) => {
  const messages = [
    ...(history.slice(0, -1).length > 0 ? [{ role: 'system', content: getSystemInstruction(config) }] : []),
    ...(config.systemInstruction ? [{ role: 'system', content: config.systemInstruction }] : []),
    ...history.map(m => {
      const content: any[] = [{ type: 'text', text: m.text }];
      if (m.attachments) {
        m.attachments.forEach(att => {
          if (att.type === 'image') {
            content.push({
              type: 'image_url',
              image_url: { url: `data:${att.mimeType};base64,${att.data}` }
            });
          }
        });
      }
      return { role: m.role === 'model' ? 'assistant' : 'user', content: content };
    }),
    { role: 'user', content: prompt }
  ];

  const response = await fetch(`${config.baseUrl || 'https://api.openai.com/v1'}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model || 'gpt-4o',
      messages: messages, 
      stream: true
    }),
    signal
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI Error: ${err}`);
  }

  await processStream(response, (line) => {
    if (line.startsWith('data: ')) {
      try {
        const json = JSON.parse(line.substring(6));
        const content = json.choices[0]?.delta?.content;
        if (content) onChunk(content);
      } catch (e) { console.error('Error parsing OpenAI SSE', e); }
    }
  });
};

const callOllama = async (config: AppConfig, history: Message[], prompt: string, onChunk: (text: string) => void, signal?: AbortSignal) => {
  const messages = [
    ...(history.slice(0, -1).length > 0 ? [{ role: 'system', content: getSystemInstruction(config) }] : []),
    ...(config.systemInstruction ? [{ role: 'system', content: config.systemInstruction }] : []),
    ...history.map(m => {
        const msgObj: any = { role: m.role === 'model' ? 'assistant' : 'user', content: m.text };
        if (m.attachments && m.attachments.length > 0) {
            msgObj.images = m.attachments.filter(a => a.type === 'image').map(a => a.data);
        }
        return msgObj;
    }),
    { role: 'user', content: prompt }
  ];

  const response = await fetch(`${config.baseUrl || 'http://localhost:11434'}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model || 'llama3',
      messages: messages,
      stream: true
    }),
    signal
  });

  if (!response.ok) throw new Error("Ollama connection failed");

  await processStream(response, (line) => {
    try {
      const json = JSON.parse(line);
      if (json.message?.content) onChunk(json.message.content);
    } catch (e) { }
  });
};

const callAnthropic = async (config: AppConfig, history: Message[], prompt: string, onChunk: (text: string) => void, signal?: AbortSignal) => {
  const correctedHistory = [...history];
  if (correctedHistory.length > 0 && correctedHistory[0].role === 'model') {
      correctedHistory.unshift({
          id: 'system_injection', 
          role: 'user', 
          text: 'Context: Continuing conversation from the following previous output.' 
      });
  }

  const anthropicMessages = [
      ...correctedHistory.map(m => {
        const content: any[] = [];
        if (m.attachments) {
            m.attachments.forEach(att => {
                if (att.type === 'image') {
                    content.push({
                        type: "image",
                        source: {
                            type: "base64",
                            media_type: att.mimeType,
                            data: att.data
                        }
                    });
                }
            });
        }
        if (m.text) content.push({ type: "text", text: m.text });
        
        return { 
            role: m.role === 'model' ? 'assistant' : 'user', 
            content: content 
        };
      }),
      { role: 'user', content: prompt }
  ];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerously-allow-browser': 'true'
    },
    body: JSON.stringify({
      model: config.model || 'claude-3-5-sonnet-20240620',
      max_tokens: 4096,
      system: history.length > 0 ? getSystemInstruction(config) : config.systemInstruction,
      messages: anthropicMessages,
      stream: true
    }),
    signal
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic Error: ${err}`);
  }

  await processStream(response, (line) => {
    if (line.startsWith('data: ')) {
      try {
        const json = JSON.parse(line.substring(6));
        if (json.type === 'content_block_delta' && json.delta?.text) {
          onChunk(json.delta.text);
        }
      } catch (e) { }
    }
  });
};
