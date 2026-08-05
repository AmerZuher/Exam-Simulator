import { createContext, useCallback, useEffect, useRef, useState, ReactNode } from 'react';
import { profilesService } from '../services/profilesService';
import { useAuth } from '../hooks/useAuth';
import type { Profile } from '../types/user';

interface ProfileContextType {
  profile: Profile | null;
  loading: boolean;
  update: (updates: Partial<Profile>) => Promise<void>;
}

export const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    profilesService.getOrCreateProfile(user.id, user)
      .then((p) => {
        if (!cancelled) {
          setProfile(p);
          setLoading(false);
        }
      })
      .catch((err) => {
        // Almost always means the `profiles` table is on an older schema —
        // check migrations/ (run 002 through 005, in order). Fail soft so
        // the rest of the app doesn't hang waiting on a profile that will
        // never arrive; profile-dependent UI already treats `profile: null`
        // as "not signed in yet" rather than crashing.
        console.error(
          '[ExamPro] Could not load your profile. This usually means a database migration is missing — see migrations/ in the repo (run 002 through 005, in order).',
          err
        );
        if (!cancelled) {
          setProfile(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Guards against out-of-order responses: if two updates are in flight
  // (e.g. one field committed just as another's debounce fires) and the
  // earlier request resolves last, it must not stomp the newer one.
  const requestSeqRef = useRef(0);

  const update = useCallback(
    async (updates: Partial<Profile>) => {
      if (!user) return;
      setProfile((prev) => (prev ? { ...prev, ...updates } : prev));
      const mySeq = ++requestSeqRef.current;
      const saved = await profilesService.updateProfile(user.id, updates);
      if (mySeq === requestSeqRef.current) setProfile(saved);
    },
    [user?.id]
  );

  return (
    <ProfileContext.Provider value={{ profile, loading, update }}>
      {children}
    </ProfileContext.Provider>
  );
}
