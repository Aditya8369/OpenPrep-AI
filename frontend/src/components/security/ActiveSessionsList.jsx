import { useState, useEffect, useCallback } from 'react';
import {
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  MapPin,
  Clock,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { getActiveSessions, revokeSession, revokeAllOtherSessions } from '../../services/api';

export default function ActiveSessionsList() {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [suspiciousAlert, setSuspiciousAlert] = useState(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const response = await getActiveSessions();
      if (response.data && response.data.success) {
        const fetchedSessions = response.data.sessions || [];
        setSessions(fetchedSessions);
        setCurrentSessionId(response.data.currentSessionId || null);

        // Check if there are geographically distant recent logins
        const activeLocations = fetchedSessions
          .filter((s) => s.geoCity && s.geoCountry && s.geoCity !== 'Unknown')
          .map((s) => `${s.geoCity}, ${s.geoCountry}`);
        const uniqueLocations = [...new Set(activeLocations)];
        if (uniqueLocations.length > 2) {
          setSuspiciousAlert({
            message: `Concurrent logins active from multiple locations (${uniqueLocations.slice(0, 3).join(' • ')}). Review unrecognized sessions below.`,
          });
        }
      } else {
        setErrorMessage(response.data?.error || 'Failed to fetch active sessions');
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error || 'Failed to connect to session manager');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevokeSingle = async (sessionId) => {
    setRevokingId(sessionId);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const response = await revokeSession(sessionId);
      if (response.data && response.data.success) {
        setSuccessMessage('Session terminated successfully');
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      } else {
        setErrorMessage(response.data?.error || 'Could not terminate session');
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error || 'Failed to terminate remote session');
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeOthers = async () => {
    if (!window.confirm('Are you sure you want to log out of all other devices?')) {
      return;
    }
    setRevokingAll(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const response = await revokeAllOtherSessions();
      if (response.data && response.data.success) {
        setSuccessMessage(`Logged out of other devices successfully (${response.data.revokedCount || 0} remote sessions terminated)`);
        // Keep only current session
        setSessions((prev) => prev.filter((s) => s.isCurrent || s.id === currentSessionId));
      } else {
        setErrorMessage(response.data?.error || 'Could not log out of other devices');
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error || 'Failed to terminate other sessions');
    } finally {
      setRevokingAll(false);
    }
  };

  const getDeviceIcon = (deviceType) => {
    const type = String(deviceType || '').toLowerCase();
    if (type === 'mobile') {
      return <Smartphone className="w-5 h-5 text-emerald-500" aria-label="Mobile Device" />;
    }
    if (type === 'tablet') {
      return <Tablet className="w-5 h-5 text-indigo-500" aria-label="Tablet Device" />;
    }
    return <Monitor className="w-5 h-5 text-amber-500" aria-label="Desktop Computer" />;
  };

  const formatTimestamp = (dateString) => {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'Recently';

    const secondsAgo = Math.floor((Date.now() - date.getTime()) / 1000);
    if (secondsAgo < 60) return 'Active just now';
    if (secondsAgo < 3600) return `Active ${Math.floor(secondsAgo / 60)}m ago`;
    if (secondsAgo < 86400) return `Active ${Math.floor(secondsAgo / 3600)}h ago`;
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent && s.id !== currentSessionId).length;

  return (
    <div className="bg-white/80 dark:bg-[#1E1611]/80 backdrop-blur-md rounded-2xl border border-[#EADBCE] dark:border-[#3D2C1E] p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#F0E4D8] dark:border-[#2D2117]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-amber-100 flex items-center gap-2">
              Active Devices & Concurrent Sessions
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                {sessions.length} Active
              </span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Manage all devices currently signed in to your OpenPrep AI account
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchSessions}
            disabled={loading}
            className="p-2 rounded-xl text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-amber-200 hover:bg-gray-100 dark:hover:bg-[#2A1F16] transition-colors"
            title="Refresh session list"
            aria-label="Refresh session list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {otherSessionsCount > 0 && (
            <button
              type="button"
              onClick={handleRevokeOthers}
              disabled={revokingAll || loading}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 transition-colors flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              {revokingAll ? 'Revoking...' : `Log Out Other Devices (${otherSessionsCount})`}
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2.5 text-xs text-rose-800 dark:text-rose-300">
          <XCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* GeoIP Anomaly Alert Banner */}
      {suspiciousAlert && (
        <div className="mb-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
          <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold uppercase tracking-wider text-[11px] text-amber-700 dark:text-amber-300">
              Suspicious GeoIP Concurrent Login Activity
            </span>
            <p className="leading-relaxed">{suspiciousAlert.message}</p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && sessions.length === 0 ? (
        <div className="space-y-3 py-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20 animate-pulse flex items-center justify-between"
            >
              <div className="space-y-2">
                <div className="h-4 w-40 bg-gray-200 dark:bg-gray-800 rounded" />
                <div className="h-3 w-64 bg-gray-200 dark:bg-gray-800 rounded" />
              </div>
              <div className="h-8 w-20 bg-gray-200 dark:bg-gray-800 rounded-lg" />
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
          No active sessions recorded.
        </div>
      ) : (
        /* Sessions List */
        <div className="space-y-3">
          {sessions.map((session) => {
            const isCurrent = session.isCurrent || session.id === currentSessionId;
            const fp = session.deviceFingerprint || {};
            const browserName = fp.browser || 'Browser';
            const osName = fp.os || 'OS';
            const locationStr =
              session.geoCity && session.geoCountry && session.geoCity !== 'Unknown'
                ? `${session.geoCity}, ${session.geoCountry}`
                : session.geoCountry || 'Location unknown';

            return (
              <div
                key={session.id}
                className={`p-4 rounded-xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isCurrent
                    ? 'border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-sm'
                    : 'border-[#EADBCE] dark:border-[#3D2C1E] bg-[#FDFBF7]/50 dark:bg-[#1A130E]/50 hover:border-amber-400/50'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#251D17] border border-[#EADBCE] dark:border-[#3D2C1E] shadow-2xs mt-0.5">
                    {getDeviceIcon(fp.deviceType)}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900 dark:text-amber-100">
                        {browserName} on {osName}
                      </span>

                      {isCurrent ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          This Device
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                          Remote Device
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1" title="Approximate IP Geo-Location">
                        <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        {locationStr}
                      </span>

                      {session.ipAddress && (
                        <span className="flex items-center gap-1 font-mono text-[11px]" title="Client IP Address">
                          <Globe className="w-3.5 h-3.5 text-blue-500" />
                          {session.ipAddress}
                        </span>
                      )}

                      <span className="flex items-center gap-1" title="Last Active Timestamp">
                        <Clock className="w-3.5 h-3.5 text-purple-500" />
                        {formatTimestamp(session.lastActiveAt || session.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end sm:self-center">
                  {isCurrent ? (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-3 py-1.5 bg-emerald-100/50 dark:bg-emerald-950/40 rounded-lg">
                      Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRevokeSingle(session.id)}
                      disabled={revokingId === session.id}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-lg text-rose-600 hover:text-white hover:bg-rose-600 dark:text-rose-400 dark:hover:bg-rose-700 border border-rose-200 dark:border-rose-900/50 transition-all cursor-pointer flex items-center gap-1"
                      aria-label={`Revoke session for ${browserName} on ${osName}`}
                    >
                      <LogOut className="w-3 h-3" />
                      {revokingId === session.id ? 'Revoking...' : 'Revoke'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
