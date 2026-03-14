import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { AppConfig } from '../types';

interface LiveInterfaceProps {
  config: AppConfig;
  onClose: () => void;
  username: string;
}

const LiveInterface: React.FC<LiveInterfaceProps> = ({ config, onClose, username }) => {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('connecting');
  const [volume, setVolume] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  
  // Audio Context Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const isConnectedRef = useRef<boolean>(false);
  
  // Playback Refs
  const nextStartTimeRef = useRef<number>(0);
  const audioQueueRef = useRef<AudioBufferSourceNode[]>([]);

  useEffect(() => {
    startSession();
    return () => stopSession();
  }, []);

  // Visualizer Loop
  useEffect(() => {
    const render = () => {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const w = canvasRef.current.width;
      const h = canvasRef.current.height;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(0, 0, 0, 0)';
      ctx.fillRect(0, 0, w, h);

      // Draw Oscilloscope
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      
      const distinctness = status === 'connected' ? 1 : 0.1;
      const amp = Math.max(volume * 150, 2) * distinctness;
      const freq = status === 'connected' ? 0.05 : 0.01;
      const speed = Date.now() * 0.005;

      for (let x = 0; x < w; x++) {
        const y = h / 2 + Math.sin(x * freq + speed) * amp * Math.sin(x * 0.01);
        ctx.lineTo(x, y);
      }
      
      ctx.strokeStyle = status === 'connected' ? '#22d3ee' : '#555'; // Cyan or Gray
      ctx.lineWidth = 2;
      ctx.stroke();

      // Glow effect
      if (status === 'connected') {
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#22d3ee';
          ctx.stroke();
          ctx.shadowBlur = 0;
      }

      animationRef.current = requestAnimationFrame(render);
    };
    render();

    return () => cancelAnimationFrame(animationRef.current);
  }, [volume, status]);

  const startSession = async () => {
    if (status === 'connected') return;
    setStatus('connecting');
    isConnectedRef.current = false;

    try {
      // Live Audio requires direct WebSocket access to Gemini API (cannot be proxied)
      // Falls back to VITE_GEMINI_API_KEY env var since API keys moved server-side
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
      if (!apiKey) {
        throw new Error('VITE_GEMINI_API_KEY required for Live Audio (direct WebSocket connection)');
      }
      const ai = new GoogleGenAI({ apiKey });
      
      // Setup Audio Contexts
      // Use system default sample rate to prevent "different sample-rate" error
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass(); 
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      audioContextRef.current = ctx;

      const inputCtx = new AudioContextClass(); 
      if (inputCtx.state === 'suspended') {
        await inputCtx.resume();
      }

      // Get Mic Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      // Connect to Gemini Live
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: `You are Nexus, a rigorous academic debate partner for ${username}. Keep responses concise, high-density, and spoken in a calm, cyberpunk-intellectual tone. Do not be overly polite. Focus on facts and logic.`,
        },
        callbacks: {
          onopen: () => {
            setStatus('connected');
            isConnectedRef.current = true;
            
            // Setup Input Processing
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              if (!isConnectedRef.current) return; // Guard against sending on closed connection

              const inputData = e.inputBuffer.getChannelData(0);
              
              // Calculate volume for visualizer
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
              setVolume(Math.sqrt(sum / inputData.length));

              // DOWNSAMPLE LOGIC (System Rate -> 16000Hz)
              const targetRate = 16000;
              const sourceRate = inputCtx.sampleRate;
              let processedData = inputData;

              if (sourceRate !== targetRate) {
                  const ratio = sourceRate / targetRate;
                  const newLength = Math.floor(inputData.length / ratio);
                  processedData = new Float32Array(newLength);
                  for (let i = 0; i < newLength; i++) {
                      const offset = i * ratio;
                      const idx = Math.floor(offset);
                      // Linear interpolation
                      const val1 = inputData[idx];
                      const val2 = idx + 1 < inputData.length ? inputData[idx + 1] : val1;
                      const frac = offset - idx;
                      processedData[i] = val1 + (val2 - val1) * frac;
                  }
              }

              // PCM Conversion
              const pcmData = new Int16Array(processedData.length);
              for (let i = 0; i < processedData.length; i++) {
                pcmData[i] = Math.max(-1, Math.min(1, processedData[i])) * 32767;
              }
              
              const base64 = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
              
              sessionPromise.then(session => {
                 if (!isConnectedRef.current) return;
                 try {
                     session.sendRealtimeInput({ 
                        media: { 
                            mimeType: 'audio/pcm;rate=16000', 
                            data: base64 
                        } 
                     });
                 } catch(err) {
                     // Suppress network errors during disconnects
                     console.warn("Input send failed", err);
                 }
              });
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
            
            inputSourceRef.current = source;
            processorRef.current = processor;
          },
          onmessage: async (msg: LiveServerMessage) => {
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
               playAudioChunk(audioData, ctx);
            }
          },
          onclose: () => {
              setStatus('disconnected');
              isConnectedRef.current = false;
          },
          onerror: (e) => {
             console.error("Live Session Error:", e);
             setStatus('error');
             isConnectedRef.current = false;
          }
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (e) {
      console.error("Failed to start Live session", e);
      setStatus('error');
      isConnectedRef.current = false;
    }
  };

  const playAudioChunk = async (base64: string, ctx: AudioContext) => {
    try {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
        
        const int16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768.0;

        // Gemini returns audio at 24000Hz. We tell the buffer this.
        // The AudioContext (running at system rate, e.g. 48000Hz) will handle the resampling playback.
        const buffer = ctx.createBuffer(1, float32.length, 24000);
        buffer.getChannelData(0).set(float32);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);

        const now = ctx.currentTime;
        // Schedule next chunk
        const start = Math.max(now, nextStartTimeRef.current);
        source.start(start);
        nextStartTimeRef.current = start + buffer.duration;
        
        audioQueueRef.current.push(source);
        source.onended = () => {
             audioQueueRef.current = audioQueueRef.current.filter(s => s !== source);
        };

        // Visualize output volume roughly
        setVolume(0.5); // Artificial visualizer bump for AI talking

    } catch (e) {
        console.error("Audio decode error", e);
    }
  };

  const stopSession = () => {
    isConnectedRef.current = false;

    // Stop Microphone Stream
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }

    // Cleanup Audio
    inputSourceRef.current?.disconnect();
    processorRef.current?.disconnect();
    audioContextRef.current?.close();
    
    // Close Session
    if (sessionRef.current) {
        sessionRef.current.then((s: any) => s.close());
    }
    setStatus('disconnected');
  };

  const handleReconnect = () => {
    stopSession();
    setTimeout(() => {
        startSession();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-500">
       <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-900/10 via-black to-black pointer-events-none"></div>
       
       <div className="relative w-full max-w-lg p-8 flex flex-col items-center gap-8">
          <div className="text-center space-y-2">
             <div className="inline-block border border-cyan-500/30 px-3 py-1 bg-cyan-950/20 rounded-full mb-4">
                 <div className="flex items-center gap-2">
                     <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-cyan-400 animate-pulse' : 'bg-red-500'}`}></div>
                     <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold">Neural Voice Link</span>
                 </div>
             </div>
             <h2 className="text-3xl font-bold text-white tracking-wider">LIVE_SYNC</h2>
             <p className="text-xs text-white/40 uppercase tracking-widest">
                {status === 'connecting' ? 'Establishing Handshake...' : 
                 status === 'connected' ? 'Channel Open // Speaking Allowed' : 
                 status === 'error' ? 'Connection Interrupt' : 'Disconnected'}
             </p>
          </div>

          {/* Visualizer Canvas */}
          <div className="w-full h-32 bg-black/50 border-y border-white/10 relative overflow-hidden">
             <canvas 
                ref={canvasRef} 
                width={500} 
                height={128} 
                className="w-full h-full"
             />
             <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black pointer-events-none"></div>
          </div>

          <div className="flex gap-4">
             {(status === 'error' || status === 'disconnected') && (
                 <button 
                   onClick={handleReconnect}
                   className="w-16 h-16 rounded-full border border-cyan-500/50 text-cyan-400 hover:bg-cyan-950/30 transition-all flex items-center justify-center group"
                   title="Reconnect"
                 >
                    <i className="fa-solid fa-rotate-right text-xl group-hover:rotate-180 transition-transform duration-500"></i>
                 </button>
             )}
             
             <button 
               onClick={onClose}
               className="w-16 h-16 rounded-full border border-red-500/50 text-red-500 hover:bg-red-950/30 transition-all flex items-center justify-center group"
               title="End Session"
             >
                <i className="fa-solid fa-phone-slash text-xl group-hover:scale-110 transition-transform"></i>
             </button>
          </div>
          
          <div className="text-[9px] text-white/20 text-center max-w-xs leading-relaxed">
             Latency: Low // Protocol: WebRTC // Encryption: Local-Only
             <br/>
             Speak clearly. The Hive is listening.
          </div>
       </div>
    </div>
  );
};

export default LiveInterface;