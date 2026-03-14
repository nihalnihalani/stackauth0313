import React from 'react';
import { AppConfig } from '../types';
import { PROVIDERS } from '../constants';

interface SettingsModalProps {
  config: AppConfig;
  setConfig: (config: AppConfig) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ config, setConfig, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in">
      <div className="w-full max-w-md border border-white/20 bg-black p-8 rounded relative shadow-2xl shadow-white/5">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>
        <h2 className="text-xl text-white mb-6 font-bold tracking-widest uppercase flex items-center gap-2">
          <i className="fa-solid fa-network-wired text-sm"></i> Neural Configuration
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">Provider Node</label>
            <select
              value={config.provider}
              onChange={(e) => setConfig({ ...config, provider: e.target.value, model: '' })}
              className="w-full bg-white/5 border border-white/10 text-white p-2 text-sm focus:border-white/50 outline-none rounded-sm"
            >
              <option value={PROVIDERS.GOOGLE}>GOOGLE GEMINI</option>
              <option value={PROVIDERS.OPENAI}>OPENAI</option>
              <option value={PROVIDERS.ANTHROPIC}>ANTHROPIC</option>
              <option value={PROVIDERS.OLLAMA}>OLLAMA (LOCAL)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">Model Designation</label>
            <input
              type="text"
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              placeholder={
                config.provider === PROVIDERS.GOOGLE ? 'gemini-3-pro-preview' :
                  config.provider === PROVIDERS.OPENAI ? 'gpt-4o' :
                    config.provider === PROVIDERS.ANTHROPIC ? 'claude-3-5-sonnet-20240620' :
                      'llama3'
              }
              className="w-full bg-white/5 border border-white/10 text-white p-2 text-sm focus:border-white/50 outline-none rounded-sm placeholder:text-white/10"
            />
          </div>

          <div className="mt-4 p-3 border border-white/10 bg-white/5 rounded-sm">
            <p className="text-[10px] text-white/40 uppercase tracking-wider">
              API keys are managed server-side. Contact your administrator to configure providers.
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-white/20 text-white hover:bg-white hover:text-black transition-all text-xs uppercase tracking-widest font-bold"
          >
            Confirm Sequence
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
