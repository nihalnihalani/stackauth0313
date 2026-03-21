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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface)]/80 backdrop-blur-[12px] p-4">
      <div className="w-full max-w-md bg-[var(--surface-container-lowest)] border border-[var(--primary-container)]/30 shadow-[0_0_100px_rgba(0,243,255,0.1)] relative overflow-hidden">
        {/* Header */}
        <div className="nexus-modal-header">
          <span className="font-headline font-black uppercase text-xs tracking-[0.15em] text-[var(--primary-container)]">CONFIGURATION</span>
          <button
            onClick={onClose}
            className="bg-[var(--surface-container)] border border-[var(--outline-variant)] text-[var(--on-surface-variant)] hover:text-[var(--primary-container)] transition-colors w-8 h-8 flex items-center justify-center"
          >
            <i className="fa-solid fa-times text-xs"></i>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="label-sm text-[var(--on-surface-variant)] block mb-2">Provider Node</label>
            <div className="relative">
              <i className="fa-solid fa-network-wired absolute left-3 top-1/2 -translate-y-1/2 text-[var(--outline)] text-xs"></i>
              <select
                value={config.provider}
                onChange={(e) => setConfig({ ...config, provider: e.target.value, model: '' })}
                className="nexus-input"
              >
                <option value={PROVIDERS.GOOGLE}>GOOGLE GEMINI</option>
                <option value={PROVIDERS.OPENAI}>OPENAI</option>
                <option value={PROVIDERS.ANTHROPIC}>ANTHROPIC</option>
                <option value={PROVIDERS.OLLAMA}>OLLAMA (LOCAL)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label-sm text-[var(--on-surface-variant)] block mb-2">Model Designation</label>
            <div className="relative">
              <i className="fa-solid fa-microchip absolute left-3 top-1/2 -translate-y-1/2 text-[var(--outline)] text-xs"></i>
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
                className="nexus-input"
              />
            </div>
          </div>

          <div className="p-3 border border-[var(--outline-variant)] bg-[var(--surface-container)]">
            <p className="text-[10px] text-[var(--outline)] uppercase tracking-wider font-headline">
              API keys are managed server-side. Contact your administrator to configure providers.
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 flex justify-end">
          <button
            onClick={onClose}
            className="nexus-btn-primary"
          >
            CONFIRM_SEQUENCE
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
