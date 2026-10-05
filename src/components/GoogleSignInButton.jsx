import React, { useEffect, useRef, useState } from 'react';

/**
 * GoogleSignInButton — Loads Google Identity Services (GIS) and renders
 * the official "Sign in with Google" button.
 *
 * Props:
 *   onSuccess(credential)  — called with the Google ID token string on successful auth
 *   onError(errorMessage)  — called with an error message string on failure
 *   clientId               — Google OAuth Client ID (optional, falls back to env)
 *   buttonText             — "signin_with" | "signup_with" | "continue_with" (default: "signin_with")
 */

const GOOGLE_GIS_SCRIPT = 'https://accounts.google.com/gsi/client';

export const GoogleSignInButton = ({
  onSuccess,
  onError,
  clientId,
  buttonText = 'signin_with'
}) => {
  const buttonRef = useRef(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState(false);

  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const resolvedClientId = clientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  // Load the GIS script
  useEffect(() => {
    if (!resolvedClientId) {
      // No client ID configured — silently skip rendering
      return;
    }

    // Check if script is already loaded
    if (window.google?.accounts?.id) {
      setScriptLoaded(true);
      return;
    }

    // Check if script tag already exists
    const existingScript = document.querySelector(`script[src="${GOOGLE_GIS_SCRIPT}"]`);
    if (existingScript) {
      const handleLoad = () => setScriptLoaded(true);
      const handleError = () => setScriptError(true);
      existingScript.addEventListener('load', handleLoad);
      existingScript.addEventListener('error', handleError);
      return () => {
        existingScript.removeEventListener('load', handleLoad);
        existingScript.removeEventListener('error', handleError);
      };
    }

    const script = document.createElement('script');
    script.src = GOOGLE_GIS_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => {
      setScriptError(true);
      onErrorRef.current?.('Failed to load Google authentication. Please try again later.');
    };
    document.head.appendChild(script);
  }, [resolvedClientId]);

  // Initialize GIS and render button once script is ready
  useEffect(() => {
    if (!scriptLoaded || !resolvedClientId || !buttonRef.current || !window.google?.accounts?.id) return;

    try {
      if (buttonRef.current) {
        buttonRef.current.innerHTML = '';
      }

      window.google.accounts.id.initialize({
        client_id: resolvedClientId,
        callback: (response) => {
          if (response?.credential) {
            onSuccessRef.current?.(response.credential);
          } else {
            onErrorRef.current?.('Google Sign-In did not return a credential. Please try again.');
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        width: buttonRef.current.offsetWidth || 360,
        text: buttonText,
        shape: 'rectangular',
        logo_alignment: 'left'
      });
    } catch (err) {
      console.error('[GoogleSignIn] Initialization error:', err);
      onErrorRef.current?.('Failed to initialize Google Sign-In.');
    }
  }, [scriptLoaded, resolvedClientId, buttonText]);

  // Don't render anything if no client ID is configured
  if (!resolvedClientId) {
    return null;
  }

  if (scriptError) {
    return (
      <div className="w-full text-center py-2">
        <p className="text-xs text-slate-400">
          Google Sign-In is temporarily unavailable.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        ref={buttonRef}
        className="w-full flex items-center justify-center"
        style={{ minHeight: '44px' }}
      />
    </div>
  );
};
