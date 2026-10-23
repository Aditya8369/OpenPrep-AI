/**
 * @fileoverview TwoFactorChallenge page for OpenPrep.
 * Displayed when user credentials are verified but the account requires 2FA authentication.
 * Supports standard 6-digit TOTP authenticator tokens or single-use recovery backup codes.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import { ShieldCheck, KeyRound, AlertCircle, ArrowLeft, BookOpen, LifeBuoy } from 'lucide-react';
import API from '../services/api';
import OtpInput from '../components/auth/OtpInput';
import { loadUser } from '../store/slices/authSlice';

export const TwoFactorChallenge = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  const [otp, setOtp] = useState(Array(6).fill(''));
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Retrieve temporary token or email passed from Login redirect
  const queryParams = new URLSearchParams(location.search);
  const tempToken = location.state?.tempToken || sessionStorage.getItem('openprep_2fa_tempToken') || '';
  const email = location.state?.email || queryParams.get('email') || '';

  useEffect(() => {
    if (!tempToken && !email) {
      // If neither is present, redirect back to login
      navigate('/login', { replace: true });
    }
  }, [tempToken, email, navigate]);

  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    const tokenToVerify = useBackupCode ? backupCode.trim() : otp.join('').trim();
    if (!tokenToVerify) {
      setError(useBackupCode ? 'Please enter a backup code.' : 'Please enter all 6 digits.');
      return;
    }

    if (!useBackupCode && tokenToVerify.length !== 6) {
      setError('Please enter all 6 digits of your authenticator code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await API.post('/auth/2fa/verify', {
        tempToken,
        email,
        token: tokenToVerify,
      });

      if (response.data.success && response.data.token) {
        localStorage.setItem('token', response.data.token);
        if (response.data.sessionId) {
          localStorage.setItem('sessionId', response.data.sessionId);
        }
        sessionStorage.removeItem('openprep_2fa_tempToken');

        // Refresh user profile in Redux store
        if (typeof dispatch === 'function') {
          dispatch(loadUser());
        }

        navigate('/dashboard', { replace: true });
      } else {
        setError(response.data.error || 'Verification failed.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid 2FA code or expired session.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit when all 6 OTP digits are entered
  useEffect(() => {
    if (!useBackupCode && otp.every((digit) => digit !== '')) {
      handleSubmit();
    }
  }, [otp, useBackupCode]);

  return (
    <div
      data-testid="two-factor-challenge-view"
      className="min-h-screen w-screen flex items-center justify-center p-4 bg-[#FFFBE9] dark:bg-[#000000] text-[#1F150C] dark:text-[#E1DCC9] font-inter relative select-none"
    >
      <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_70%_20%,rgba(173,139,115,0.12),transparent_50%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md bg-[#FFFBE9] dark:bg-[#16120E] rounded-3xl border border-[#CEAB93]/60 dark:border-[#412D15] shadow-2xl p-6 sm:p-8 relative z-10 space-y-6"
      >
        {/* Top Logo */}
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="bg-[#AD8B73] dark:bg-[#1F150C] p-2 rounded-xl border border-[#CEAB93]/50 dark:border-[#412D15]">
              <BookOpen className="h-5 w-5 text-[#FFFBE9] dark:text-[#E1DCC9]" />
            </div>
            <span className="font-playfair text-lg font-bold">OpenPrep AI</span>
          </Link>
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-extrabold font-playfair tracking-tight text-[#1F150C] dark:text-[#E1DCC9]">
            Two-Factor Verification
          </h1>
          <p className="text-xs text-[#412D15] dark:text-[#C4BA9D] mt-1.5 leading-relaxed">
            {useBackupCode
              ? 'Enter one of your 8-character emergency backup recovery codes.'
              : 'Enter the 6-digit code from your authenticator app.'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            data-testid="challenge-error-alert"
            className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2 text-xs text-red-700 dark:text-red-300 font-medium"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Challenge Input Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {!useBackupCode ? (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-center">
                6-Digit Security Code
              </label>
              <div className="flex justify-center">
                <OtpInput otp={otp} setOtp={setOtp} />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor="backup-code-input" className="block text-xs font-bold">
                Emergency Backup Code
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C6A53] dark:text-[#C4BA9D]" />
                <input
                  id="backup-code-input"
                  data-testid="backup-code-input"
                  type="text"
                  maxLength={12}
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value)}
                  placeholder="e.g. a1b2c3d4"
                  autoFocus
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-[#FFFBE9] dark:bg-[#251D17] border border-[#CEAB93] dark:border-[#412D15] rounded-xl text-center text-base font-mono font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-[#AD8B73] transition-all"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="submit-2fa-verify-btn"
            className="w-full py-3 rounded-xl btn-primary-theme font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              'Verify & Continue'
            )}
          </button>
        </form>

        {/* Toggle between OTP and Backup Code */}
        <div className="pt-2 border-t border-[#CEAB93]/30 dark:border-[#412D15] flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setUseBackupCode(!useBackupCode);
              setError('');
            }}
            data-testid="toggle-backup-mode-btn"
            className="text-xs text-[#AD8B73] dark:text-[#C4BA9D] hover:underline font-semibold flex items-center gap-1.5"
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            <span>{useBackupCode ? 'Use Authenticator Code instead' : 'Lost your phone? Use a backup code'}</span>
          </button>

          <Link
            to="/login"
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Back to Sign in</span>
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default TwoFactorChallenge;
