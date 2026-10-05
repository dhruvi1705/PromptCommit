import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Layers,
  Lock,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  UserCheck,
  GitBranch
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

export const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, demoLogin, googleLogin } = useAuth();

  const searchParams = new URLSearchParams(location.search);
  const redirectPath = searchParams.get('redirect') || '/app';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await login(email, password);
      setLoading(false);
      if (res.success) {
        navigate(redirectPath);
      } else {
        setError(res.message || 'Invalid email or password.');
      }
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Login failed.');
    }
  };

  const handleQuickDemo = async (userId, userEmail) => {
    setEmail(userEmail);
    setPassword('password123');
    setLoading(true);
    const res = await demoLogin(userId);
    setLoading(false);
    if (res.success) {
      navigate(redirectPath);
    } else {
      setError(res.message || 'Demo login failed.');
    }
  };

  const handleGoogleSuccess = async (credential) => {
    setError('');
    setLoading(true);
    try {
      const res = await googleLogin(credential);
      setLoading(false);
      if (res.success) {
        navigate(redirectPath);
      } else {
        setError(res.message || 'Google sign-in failed.');
      }
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Google sign-in failed.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row font-sans">
      {/* LEFT SIDE (Branded Section ~45%) */}
      <div className="lg:w-[45%] bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-8 sm:p-12 lg:p-16 flex flex-col justify-between relative shadow-sm">
        <div>
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm text-white transition">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-slate-900">PromptCommit</span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 ml-2 bg-blue-50 text-blue-700 border border-blue-200 rounded">
                PRIVATE
              </span>
            </div>
          </Link>

          {/* Heading */}
          <div className="mt-12 space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-tight">
              Sign in to your private prompt vault.
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              Track prompt commits, test model responses, and roll back iterations in a secure, isolated workspace.
            </p>
          </div>

          {/* Value Props Bullet List */}
          <div className="mt-8 space-y-3.5">
            <div className="flex items-start space-x-3">
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 mt-0.5">
                <GitBranch className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Git-Style Version Control</h4>
                <p className="text-xs text-slate-500">Every prompt iteration is tagged, timestamped, and diffable.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 mt-0.5">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Strictly Isolated Workspaces</h4>
                <p className="text-xs text-slate-500">Accounts operate in complete privacy with zero cross-tenant leakage.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE (Sign In Form ~55%) */}
      <div className="lg:w-[55%] flex items-center justify-center p-6 sm:p-12">
        <div className="max-w-md w-full space-y-6 bg-white p-7 sm:p-8 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Welcome back
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Enter your workspace credentials to access your private vault.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Google Sign-In */}
          <GoogleSignInButton
            onSuccess={handleGoogleSuccess}
            onError={(msg) => setError(msg)}
            buttonText="signin_with"
          />

          {/* OR Divider */}
          <div className="flex items-center space-x-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full h-10 bg-white text-xs text-slate-900 placeholder-slate-400 px-3 rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 bg-white text-xs text-slate-900 placeholder-slate-400 px-3 pr-10 rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 bg-slate-100 border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span>Remember this device</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign In to Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500">
            Don't have a private workspace?{' '}
            <Link to="/signup" className="font-semibold text-blue-600 hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
