'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

type ActiveSession = { code: string; token: string };
type PersistedSession = ActiveSession & { savedAt: number };

const SESSION_KEY = 'avalon.session';
const RESUME_KEY = 'avalon.session.resume.v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function parseSession(raw: string | null): ActiveSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ActiveSession>;
    if (
      typeof value.code !== 'string' ||
      !/^[A-Z2-9]{6}$/.test(value.code) ||
      typeof value.token !== 'string' ||
      value.token.length < 16
    )
      return null;
    return { code: value.code, token: value.token };
  } catch {
    return null;
  }
}

function parsePersisted(raw: string | null): PersistedSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PersistedSession>;
    const active = parseSession(
      JSON.stringify({ code: value.code, token: value.token }),
    );
    if (
      !active ||
      typeof value.savedAt !== 'number' ||
      Date.now() - value.savedAt > MAX_AGE_MS
    )
      return null;
    return { ...active, savedAt: value.savedAt };
  } catch {
    return null;
  }
}

/**
 * sessionStorage is ideal while a tab stays alive, but installed PWAs and mobile
 * browsers are routinely killed by the OS. Mirror the authenticated seat token
 * into a short-lived local resume record so reopening the app can recover the
 * exact same seat instead of stranding an active game.
 *
 * A restored private game always re-locks the role UI before it can be left on
 * screen. The actual game state still comes from the server.
 */
export function SessionRescue() {
  const restored = useRef(false);

  useLayoutEffect(() => {
    try {
      if (parseSession(sessionStorage.getItem(SESSION_KEY))) return;

      const persisted = parsePersisted(localStorage.getItem(RESUME_KEY));
      if (!persisted) {
        localStorage.removeItem(RESUME_KEY);
        return;
      }

      const invite = new URLSearchParams(location.search)
        .get('room')
        ?.toUpperCase();
      if (invite && invite !== persisted.code) return;

      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ code: persisted.code, token: persisted.token }),
      );
      restored.current = true;
      document.documentElement.dataset.avalonResumePrivacy = 'locked';
    } catch {}
  }, []);

  useEffect(() => {
    let previous = '';

    const mirror = () => {
      try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if ((raw ?? '') === previous) return;
        previous = raw ?? '';

        const active = parseSession(raw);
        if (!active) {
          localStorage.removeItem(RESUME_KEY);
          return;
        }

        localStorage.setItem(
          RESUME_KEY,
          JSON.stringify({ ...active, savedAt: Date.now() } satisfies PersistedSession),
        );
      } catch {}
    };

    mirror();
    const timer = window.setInterval(mirror, 750);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') mirror();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      mirror();
    };
  }, []);

  useEffect(() => {
    if (!restored.current) return;

    let privacyApplied = false;
    const lockPrivateRole = () => {
      if (privacyApplied) return;
      const hide = document.querySelector<HTMLButtonElement>(
        '.role-strip:not(.concealed) button[aria-label="Hide role and knowledge"]',
      );
      if (!hide) return;
      privacyApplied = true;
      hide.click();
      document.documentElement.removeAttribute('data-avalon-resume-privacy');
    };

    const observer = new MutationObserver(lockPrivateRole);
    observer.observe(document.body, { childList: true, subtree: true });
    lockPrivateRole();

    const timeout = window.setTimeout(() => {
      observer.disconnect();
      document.documentElement.removeAttribute('data-avalon-resume-privacy');
    }, 8000);

    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
      document.documentElement.removeAttribute('data-avalon-resume-privacy');
    };
  }, []);

  return null;
}
