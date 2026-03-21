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
    <div className="fixed inset-0 bg-[var(--surface)]/80 backdrop-blur-[16px] flex items-center justify-center z-50 p-4">
      <div className="nexus-modal max-w-lg w-full">
        {/* Header */}
        <div className="nexus-modal-header">
          <span className="font-headline font-black text-sm tracking-[0.15em] text-[var(--primary-container)]">
            DATA_MIGRATION_PROTOCOL
          </span>
        </div>

        <div className="p-6">
          {status === 'prompt' && (
            <>
              <h2 className="font-headline text-lg font-bold text-[var(--primary)] tracking-wider uppercase mb-3">
                LEGACY DATA DETECTED
              </h2>
              <p className="text-xs text-[var(--on-surface-variant)] leading-relaxed mb-4 font-body">
                We found existing data under username <span className="text-[var(--primary-container)] font-bold">"{migrationInfo.oldUsername}"</span>.
                Would you like to transfer it to your new authenticated account?
              </p>

              <div className="space-y-2 mb-6">
                <div className="flex justify-between bg-[var(--surface-container)] border border-[var(--outline-variant)] px-3 py-2">
                  <span className="label-sm text-[var(--on-surface-variant)]">Chat Sessions</span>
                  <span className="font-headline text-[2rem] leading-none text-[var(--primary-container)]">{migrationInfo.chatCount}</span>
                </div>
                <div className="flex justify-between bg-[var(--surface-container)] border border-[var(--outline-variant)] px-3 py-2">
                  <span className="label-sm text-[var(--on-surface-variant)]">Notes</span>
                  <span className="font-headline text-[2rem] leading-none text-[var(--primary-container)]">{migrationInfo.noteCount}</span>
                </div>
                <div className="flex justify-between bg-[var(--surface-container)] border border-[var(--outline-variant)] px-3 py-2">
                  <span className="label-sm text-[var(--on-surface-variant)]">Syllabus</span>
                  <span className="font-headline text-[2rem] leading-none text-[var(--primary-container)]">{migrationInfo.syllabusExists ? 'Yes' : 'No'}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleMigrate}
                  className="nexus-btn-primary flex-1 text-center"
                >
                  EXECUTE_TRANSFER
                </button>
                <button
                  onClick={handleSkip}
                  className="nexus-btn-secondary flex-1 text-center"
                >
                  INITIALIZE_NEW
                </button>
              </div>

              <p className="label-sm text-[0.5rem] text-[var(--outline)] mt-3 text-center">
                Skipping will not delete your old data, but it will not be accessible under your new account.
              </p>
            </>
          )}

          {status === 'migrating' && (
            <div className="text-center py-8 relative">
              <div className="absolute inset-0 scanline pointer-events-none"></div>
              <div className="label-sm text-[var(--primary-container)] animate-pulse tracking-[0.3em]">
                Transferring Data...
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center py-8">
              <div className="label-sm text-[var(--tertiary-container)] tracking-[0.3em] drop-shadow-[0_0_10px_rgba(54,253,15,0.4)]">
                TRANSFER_COMPLETE
              </div>
              <p className="text-[10px] text-[var(--on-surface-variant)] mt-2">Redirecting...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="py-4">
              <div className="label-sm text-[var(--error)] tracking-wider mb-2">
                Migration Failed
              </div>
              <p className="text-[10px] text-[var(--on-surface-variant)] mb-4">{errorMsg}</p>
              <div className="flex gap-3">
                <button
                  onClick={handleRetry}
                  className="nexus-btn-primary flex-1 text-center"
                >
                  RETRY
                </button>
                <button
                  onClick={handleSkip}
                  className="nexus-btn-secondary flex-1 text-center"
                >
                  SKIP
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MigrationPrompt;
