import { createContext, useCallback, useEffect, useState, ReactNode } from 'react';
import { examsService } from '../services/examsService';
import { useAuth } from '../hooks/useAuth';
import type { ExamGroup, GroupLink } from '../types/exam';

interface GroupsContextType {
  groups: ExamGroup[];
  loading: boolean;
  createGroup: (name: string, opts?: { description?: string; icon?: string; color?: string; logo?: string | null }) => Promise<ExamGroup>;
  updateGroup: (id: string, updates: Partial<ExamGroup>) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  setGroupLinks: (id: string, links: GroupLink[]) => Promise<void>;
  refetch: () => Promise<void>;
}

export const GroupsContext = createContext<GroupsContextType | undefined>(undefined);

export function GroupsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<ExamGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    if (!user) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await examsService.getGroups(user.id);
    setGroups(data);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const createGroup = async (
    name: string,
    opts?: { description?: string; icon?: string; color?: string; logo?: string | null }
  ): Promise<ExamGroup> => {
    if (!user) throw new Error('User not authenticated');
    const group = await examsService.createGroup({ user_id: user.id, name, ...opts });
    setGroups((prev) => [...prev, group]);
    return group;
  };

  const updateGroup = async (id: string, updates: Partial<ExamGroup>) => {
    const updated = await examsService.updateGroup(id, updates);
    setGroups((prev) => prev.map((g) => (g.id === id ? updated : g)));
  };

  const deleteGroup = async (id: string) => {
    await examsService.deleteGroup(id);
    setGroups((prev) => prev.filter((g) => g.id !== id));
  };

  const setGroupLinks = async (id: string, links: GroupLink[]) => {
    const updated = await examsService.addGroupLink(id, links);
    setGroups((prev) => prev.map((g) => (g.id === id ? updated : g)));
  };

  return (
    <GroupsContext.Provider value={{ groups, loading, createGroup, updateGroup, deleteGroup, setGroupLinks, refetch: fetchGroups }}>
      {children}
    </GroupsContext.Provider>
  );
}
