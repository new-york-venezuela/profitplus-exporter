'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import type { SessionPayload } from '@/lib/auth/session';

let initialized = false;

export function PostHogProvider({
  user,
  children,
}: {
  user: SessionPayload;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    if (!initialized) {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: true,
      });
      initialized = true;
    }

    posthog.identify(user.sub, { role: user.role, name: user.name });
  }, [user.sub, user.role, user.name]);

  return children;
}
