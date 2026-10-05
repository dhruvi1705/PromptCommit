import React, { useState, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Layers,
  Lock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  XCircle,
  Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

export const Signup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signup, googleLogin } = useAuth();

  const searchParams = new URLSearchParams(location.search);
  const redirectPath = searchParams.get('redirect') || '/app';

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Password validation rules
  const passwordRules = useMemo(() => [
    { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
    { label: 'One uppercase letter (A-Z)', test: (pw) => /[A-Z]/.test(pw) },
    { label: 'One lowercase letter (a-z)', test: (pw) => /[a-z]/.test(pw) },
    { label: 'One number (0-9)', test: (pw) => /[0-9]/.test(pw) },
    { label: 'One special character (!@#$...)', test: (pw) => /[^a-zA-Z0-9]/.test(pw) },
  ], []);

  const allPasswordRulesPass = password.length > 0 && passwordRules.every((r) => r.test(password));

  // Username validation
  const usernameValid = username.length >= 3 && username.length <= 30 && /^[a-zA-Z0-9_]+$/.test(username);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Frontend validation (mirrors backend, backend remains authoritative)
    if (!username.trim()) {
      setError('Username is required.');
      return;
    }
    if (username.trim().length < 3 || username.trim().length > 30) {
      setError('Username must be between 3 and 30 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      setError('Username can only contain letters, numbers, and underscores.');
      return;
    }

    if (!allPasswordRulesPass) {
      setError('Password does not meet all requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!agreeTerms) {
      setError('Please accept terms of service.');
      return;
    }

    setLoading(true);

    try {
      const res = await signup({
        username: username.trim(),
        email: email.trim(),
        password,
        confirm_password: confirmPassword,
        name: fullName.trim() || undefined,
      });
      setLoading(false);
      if (res && res.success === false) {
        setError(res.message || 'Failed to create account.');
      } else {
        navigate(redirectPath);
      }
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Failed to create account.');
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
        setError(res.message || 'Google sign-up failed.');
      }
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Google sign-up failed.');
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
              Create your private prompt vault today.
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              Start building, testing, and versioning your mission-critical AI prompts with full privacy and zero public leaks.
            </p>
          </div>

          {/* Value Props */}
          <div className="mt-8 space-y-4">
            <div className="flex items-start space-x-3">
              <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-900">Isolated Workspace Vault</h4>
                <p className="text-xs text-slate-500">Your prompts are segregated by user account with local persistence.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-900">Multi-Model Playground & Testing</h4>
                <p className="text-xs text-slate-500">Execute simulations on Google Gemini, Groq, OpenRouter, and Mistral AI.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-900">Instant Rollbacks & Diffing</h4>
                <p className="text-xs text-slate-500">Never lose a working iteration with instant 1-click snapshot restore.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-200 text-xs text-slate-500 flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <span>Zero third-party data scraping • 100% Client-side sandbox</span>
        </div>
      </div>

      {/* RIGHT SIDE (Sign Up Form ~55%) */}
      <div className="lg:w-[55%] flex items-center justify-center p-6 sm:p-12">
        <div className="max-w-md w-full space-y-5 bg-white p-7 sm:p-8 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Create an Account
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Set up your username and password to initialize your private repository.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Google Sign-Up */}
          <GoogleSignInButton
            onSuccess={handleGoogleSuccess}
            onError={(msg) => setError(msg)}
            buttonText="signup_with"
          />

          {/* OR Divider */}
          <div className="flex items-center space-x-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Full Name (optional) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Aanshi Shah"
                className="w-full h-10 bg-white text-xs text-slate-900 placeholder-slate-400 px-3 rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none transition"
              />
            </div>

            {/* Username (required) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Username *
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. aanshi_shah"
                className={`w-full h-10 bg-white text-xs text-slate-900 placeholder-slate-400 px-3 rounded-lg border focus:ring-1 focus:outline-none transition ${
                  username.length > 0
                    ? usernameValid
                      ? 'border-green-400 focus:border-green-500 focus:ring-green-500/20'
                      : 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-slate-300 focus:border-blue-600 focus:ring-blue-600/20'
                }`}
              />
              {username.length > 0 && !usernameValid && (
                <p className="text-[11px] text-red-500 mt-1">
                  3–30 characters, letters, numbers, and underscores only.
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address *
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

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Password *
              </label>
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

              {/* Password requirements checklist */}
              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  {passwordRules.map((rule, idx) => {
                    const passes = rule.test(password);
                    return (
                      <div key={idx} className="flex items-center space-x-1.5">
                        {passes ? (
                          <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                        )}
                        <span className={`text-[11px] ${passes ? 'text-green-600' : 'text-slate-500'}`}>
                          {rule.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Confirm Password *
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full h-10 bg-white text-xs text-slate-900 placeholder-slate-400 px-3 pr-10 rounded-lg border focus:ring-1 focus:outline-none transition ${
                    confirmPassword.length > 0
                      ? confirmPassword === password
                        ? 'border-green-400 focus:border-green-500 focus:ring-green-500/20'
                        : 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-slate-300 focus:border-blue-600 focus:ring-blue-600/20'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && confirmPassword !== password && (
                <p className="text-[11px] text-red-500 mt-1">Passwords do not match.</p>
              )}
            </div>

            {/* Terms */}
            <div>
              <label className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 bg-slate-100 border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span>I accept terms of service and workspace privacy policy</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>Creating workspace...</span>
              ) : (
                <>
                  <span>Create Account & Vault</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
