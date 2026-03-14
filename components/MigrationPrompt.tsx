import React, { useState } from 'react';
import { MigrationCheck, executeMigration, skipMigration } from '../services/migrationService';

interface MigrationPromptProps {
  migrationInfo: MigrationCheck;
  newUserId: string;
  onComplete: () => void;
}

const MigrationPrompt: React.FC<MigrationPromptProps> = ({ migrationInfo, newUserId, onComplete }) => {
  const [status, setStatus] = useState<'prompt' | 'migrating' | 'success' | 'error'>('prompt');
  const [errorMsg, setErrorMsg] = useState('');

  const handleMigrate = () => {
    setStatus('migrating');
    try {
      const success = executeMigration(migrationInfo.oldUsername, newUserId);
      if (success) {
        setStatus('success');
        setTimeout(onComplete, 1500);
      } else {
        setStatus('error');
        setErrorMsg('Migration returned false. Some data may not have transferred.');
      }
    } catch (e) {
      setStatus('error');
      setErrorMsg(e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const handleSkip = () => {
    skipMigration();
    onComplete();
  };

  const handleRetry = () => {
    setStatus('prompt');
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-black border border-white/20 max-w-md w-full p-6">
        {/* Header */}
        <div className="border-b border-white/10 pb-3 mb-4">
          <div className="text-[10px] tracking-[0.3em] uppercase text-white/40 mb-1">
            Data_Migration_Protocol
          </div>
          <h2 className="text-lg font-bold tracking-wider">LEGACY DATA DETECTED</h2>
        </div>

        {status === 'prompt' && (
          <>
            <p className="text-xs text-white/60 leading-relaxed mb-4">
              We found existing data under username <span className="text-cyan-400 font-bold">"{migrationInfo.oldUsername}"</span>.
              Would you like to transfer it to your new authenticated account?
            </p>

            <div className="space-y-2 mb-6 text-xs">
              <div className="flex justify-between border border-white/10 px-3 py-2">
                <span className="text-white/40 uppercase tracking-wider">Chat Sessions</span>
                <span className="text-white font-mono">{migrationInfo.chatCount}</span>
              </div>
              <div className="flex justify-between border border-white/10 px-3 py-2">
                <span className="text-white/40 uppercase tracking-wider">Notes</span>
                <span className="text-white font-mono">{migrationInfo.noteCount}</span>
              </div>
              <div className="flex justify-between border border-white/10 px-3 py-2">
                <span className="text-white/40 uppercase tracking-wider">Syllabus</span>
                <span className="text-white font-mono">{migrationInfo.syllabusExists ? 'Yes' : 'No'}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleMigrate}
                className="flex-1 bg-white text-black text-xs font-bold uppercase tracking-wider py-2 px-4 hover:bg-white/90 transition-colors"
              >
                Transfer Data
              </button>
              <button
                onClick={handleSkip}
                className="flex-1 border border-white/20 text-white/60 text-xs uppercase tracking-wider py-2 px-4 hover:border-white/40 hover:text-white/80 transition-colors"
              >
                Start Fresh
              </button>
            </div>

            <p className="text-[9px] text-white/20 mt-3 text-center uppercase tracking-widest">
              Skipping will not delete your old data, but it will not be accessible under your new account.
            </p>
          </>
        )}

        {status === 'migrating' && (
          <div className="text-center py-8">
            <div className="text-xs text-white/40 uppercase tracking-[0.3em] animate-pulse">
              Transferring Data...
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center py-8">
            <div className="text-xs text-cyan-400 uppercase tracking-[0.3em]">
              Migration Complete
            </div>
            <p className="text-[10px] text-white/40 mt-2">Redirecting...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="py-4">
            <div className="text-xs text-red-400 uppercase tracking-wider mb-2">
              Migration Failed
            </div>
            <p className="text-[10px] text-white/40 mb-4">{errorMsg}</p>
            <div className="flex gap-3">
              <button
                onClick={handleRetry}
                className="flex-1 border border-white/20 text-white text-xs uppercase tracking-wider py-2 px-4 hover:border-white/40 transition-colors"
              >
                Retry
              </button>
              <button
                onClick={handleSkip}
                className="flex-1 border border-white/20 text-white/40 text-xs uppercase tracking-wider py-2 px-4 hover:border-white/40 hover:text-white/60 transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MigrationPrompt;
