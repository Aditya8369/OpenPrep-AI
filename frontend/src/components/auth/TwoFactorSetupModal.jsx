/**
 * @fileoverview Modal component for initiating and completing TOTP Two-Factor Authentication setup.
 * Guides the user through:
 * 1. Scanning the QR code with an Authenticator app (Google Authenticator, Authy, Microsoft Authenticator)
 * 2. Verifying a live 6-digit code to activate 2FA
 * 3. Displaying 8 one-time emergency backup recovery codes with copy/download options
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  QrCode,
  KeyRound,
  Copy,
  Check,
  Download,
  AlertCircle,
  ArrowRight,
  Lock,
  X,
  CheckCircle2,
} from 'lucide-react';
import API from '../../services/api';

export const TwoFactorSetupModal = ({ isOpen, onClose, onSetupComplete }) => {
  const [step, setStep] = useState(1); // 1: QR & Secret, 2: Verify Code, 3: Backup Codes
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [setupData, setSetupData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [confirmedSavedCodes, setConfirmedSavedCodes] = useState(false);

  useEffect(() => {
    if (isOpen) {
      initiateSetup();
    } else {
      // Reset state on modal close
      setStep(1);
      setError('');
      setVerificationCode('');
      setSetupData(null);
      setConfirmedSavedCodes(false);
    }
  }, [isOpen]);

  const initiateSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await API.post('/auth/2fa/generate');
      if (res.data.success) {
        setSetupData(res.data);
      } else {
        setError(res.data.error || 'Failed to initialize 2FA setup.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Network error while generating 2FA credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = () => {
    if (setupData?.secret) {
      navigator.clipboard.writeText(setupData.secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  const handleVerifyAndEnable = async (e) => {
    e.preventDefault();
    if (!verificationCode || verificationCode.trim().length !== 6) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await API.post('/auth/2fa/enable', { token: verificationCode.trim() });
      if (res.data.success) {
        setStep(3); // Move to Step 3: show backup codes
      } else {
        setError(res.data.error || 'Invalid verification code. Please try again.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed. Please check your authenticator clock.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyBackupCodes = () => {
    if (setupData?.backupCodes) {
      navigator.clipboard.writeText(setupData.backupCodes.join('\n'));
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    }
  };

  const handleDownloadBackupCodes = () => {
    if (!setupData?.backupCodes) return;
    const content = `OPENPREP AI - TWO-FACTOR RECOVERY BACKUP CODES\nGenerated: ${new Date().toISOString()}\n\nEach code can only be used once to access your account if you lose your phone:\n\n${setupData.backupCodes.map((code, idx) => `${idx + 1}. ${code}`).join('\n')}\n\nKeep these codes in a safe place!`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openprep-backup-codes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFinish = () => {
    if (onSetupComplete) {
      onSetupComplete();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      data-testid="two-factor-setup-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="w-full max-w-lg bg-[#FFFBE9] dark:bg-[#16120E] border border-[#CEAB93]/80 dark:border-[#412D15] rounded-3xl shadow-2xl overflow-hidden flex flex-col text-[#1F150C] dark:text-[#E1DCC9]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#CEAB93]/30 dark:border-[#412D15]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#AD8B73]/20 text-[#AD8B73] dark:text-[#E1DCC9]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 id="modal-title" className="text-lg font-bold font-playfair">
                Two-Factor Authentication (2FA)
              </h2>
              <p className="text-xs text-[#8C6A53] dark:text-[#C4BA9D]">
                Step {step} of 3: {step === 1 ? 'Pair Authenticator' : step === 2 ? 'Verify Setup' : 'Save Backup Codes'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl hover:bg-[#CEAB93]/20 text-[#8C6A53] dark:text-[#C4BA9D] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {error && (
            <div
              role="alert"
              data-testid="setup-error-alert"
              className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-700 dark:text-red-300 font-medium flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading && !setupData ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-sm text-[#8C6A53] dark:text-[#C4BA9D]">
              <span className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>Generating cryptographic credentials...</span>
            </div>
          ) : step === 1 ? (
            /* STEP 1: Scan QR Code or Copy Secret Key */
            <div className="space-y-5">
              <p className="text-xs text-[#412D15] dark:text-[#C4BA9D] leading-relaxed">
                Scan the QR code below using your authenticator app (e.g., <strong>Google Authenticator</strong>, <strong>Authy</strong>, or <strong>Microsoft Authenticator</strong>).
              </p>

              {/* QR Code Container */}
              <div className="flex justify-center p-4 bg-white dark:bg-white rounded-2xl border border-[#CEAB93]/50 shadow-inner w-fit mx-auto">
                {setupData?.qrCodeUrl ? (
                  <img
                    src={setupData.qrCodeUrl}
                    alt="Two-factor authentication QR Code"
                    data-testid="setup-qr-code"
                    className="w-48 h-48 rounded-lg"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-xs text-gray-400">
                    QR Code unavailable
                  </div>
                )}
              </div>

              {/* Manual Secret Key */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C6A53] dark:text-[#C4BA9D]">
                  Can't scan? Enter this key manually:
                </span>
                <div className="flex items-center gap-2">
                  <code
                    data-testid="manual-secret-key"
                    className="flex-1 px-3 py-2 bg-neutral-100 dark:bg-[#251D17] border border-[#CEAB93]/60 dark:border-[#412D15] rounded-xl text-xs font-mono font-bold tracking-wider select-all overflow-x-auto"
                  >
                    {setupData?.secret}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    data-testid="copy-secret-btn"
                    className="px-3 py-2 bg-[#CEAB93]/30 hover:bg-[#CEAB93]/50 text-[#1F150C] dark:text-[#E1DCC9] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    {copiedSecret ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedSecret ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                data-testid="next-to-verify-btn"
                className="w-full py-3 rounded-xl btn-primary-theme font-bold text-xs shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
              >
                <span>Continue to Verification</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : step === 2 ? (
            /* STEP 2: Enter 6-digit verification code */
            <form onSubmit={handleVerifyAndEnable} className="space-y-5">
              <p className="text-xs text-[#412D15] dark:text-[#C4BA9D] leading-relaxed">
                Enter the 6-digit confirmation code displayed in your authenticator app to activate 2FA for your account.
              </p>

              <div>
                <label htmlFor="twofa-verification-input" className="block text-xs font-bold mb-1.5">
                  6-Digit Authenticator Code
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C6A53] dark:text-[#C4BA9D]" />
                  <input
                    id="twofa-verification-input"
                    data-testid="twofa-verification-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    autoFocus
                    required
                    className="w-full pl-10 pr-4 py-3 bg-[#FFFBE9] dark:bg-[#251D17] border border-[#CEAB93] dark:border-[#412D15] rounded-xl text-center text-lg font-bold tracking-[0.35em] focus:outline-none focus:ring-2 focus:ring-[#AD8B73] transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-1/3 py-2.5 rounded-xl border border-[#CEAB93]/60 hover:bg-[#CEAB93]/20 font-semibold text-xs transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || verificationCode.length !== 6}
                  data-testid="confirm-enable-btn"
                  className="flex-1 py-2.5 rounded-xl btn-primary-theme font-bold text-xs shadow-md disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Activate 2FA</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* STEP 3: Display 8 Backup Recovery Scratch Codes */
            <div className="space-y-5">
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Lock className="w-4 h-4" />
                  Save your emergency backup recovery codes
                </p>
                <p className="text-[11px] leading-relaxed">
                  If you ever lose access to your authenticator app, these one-time codes will be the <strong>only way</strong> to log into your account. Store them securely.
                </p>
              </div>

              {/* Codes Grid */}
              <div
                data-testid="backup-codes-grid"
                className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 bg-neutral-100 dark:bg-[#251D17] border border-[#CEAB93]/60 dark:border-[#412D15] rounded-2xl"
              >
                {setupData?.backupCodes?.map((code, index) => (
                  <div
                    key={index}
                    className="p-2 text-center font-mono font-bold text-xs tracking-wider bg-white dark:bg-[#16120E] border border-[#CEAB93]/40 dark:border-[#412D15] rounded-lg select-all"
                  >
                    {code}
                  </div>
                ))}
              </div>

              {/* Actions: Copy & Download */}
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={handleCopyBackupCodes}
                  data-testid="copy-backup-codes-btn"
                  className="flex-1 py-2 px-3 bg-[#CEAB93]/30 hover:bg-[#CEAB93]/50 text-[#1F150C] dark:text-[#E1DCC9] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  {copiedCodes ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCodes ? 'Codes Copied!' : 'Copy All Codes'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadBackupCodes}
                  data-testid="download-backup-codes-btn"
                  className="flex-1 py-2 px-3 bg-[#CEAB93]/30 hover:bg-[#CEAB93]/50 text-[#1F150C] dark:text-[#E1DCC9] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download .txt</span>
                </button>
              </div>

              {/* Confirmation checkbox */}
              <label className="flex items-start gap-2.5 text-xs text-[#412D15] dark:text-[#C4BA9D] cursor-pointer pt-2">
                <input
                  type="checkbox"
                  data-testid="confirm-saved-checkbox"
                  checked={confirmedSavedCodes}
                  onChange={(e) => setConfirmedSavedCodes(e.target.checked)}
                  className="mt-0.5 rounded border-[#CEAB93] text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span>I have safely saved or written down these 8 recovery codes.</span>
              </label>

              <button
                type="button"
                disabled={!confirmedSavedCodes}
                onClick={handleFinish}
                data-testid="finish-setup-btn"
                className="w-full py-3 rounded-xl btn-primary-theme font-bold text-xs shadow-md disabled:opacity-50 transition"
              >
                Done & Enable 2FA
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TwoFactorSetupModal;
