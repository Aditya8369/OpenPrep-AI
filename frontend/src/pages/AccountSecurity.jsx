import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  Smartphone,
  Lock,
  KeyRound,
  AlertTriangle,
  Fingerprint,
} from 'lucide-react';
import ActiveSessionsList from '../components/security/ActiveSessionsList';
import PasskeySettings from '../components/PasskeySettings';
import SecuritySettings from '../components/SecuritySettings';

export default function AccountSecurity() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('sessions');

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-[#120D0A] text-gray-900 dark:text-gray-100 py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between pb-2">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-amber-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-amber-100 flex items-center gap-2.5">
              <ShieldCheck className="w-8 h-8 text-amber-500" />
              Account Security Center
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Review active logins, terminate remote sessions, and manage biometric passkeys & 2FA
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#EADBCE] dark:border-[#3D2C1E] gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('sessions')}
            className={`pb-3 px-4 text-xs font-bold transition-all relative flex items-center gap-2 ${
              activeTab === 'sessions'
                ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500'
                : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            Active Sessions & GeoIP
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('passkeys')}
            className={`pb-3 px-4 text-xs font-bold transition-all relative flex items-center gap-2 ${
              activeTab === 'passkeys'
                ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500'
                : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Fingerprint className="w-4 h-4" />
            Passkeys & 2FA
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'sessions' ? (
          <div className="space-y-6">
            <ActiveSessionsList />
          </div>
        ) : (
          <div className="space-y-6">
            <SecuritySettings />
          </div>
        )}
      </div>
    </div>
  );
}
