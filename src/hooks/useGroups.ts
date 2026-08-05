import { useContext } from 'react';
import { GroupsContext } from '../contexts/GroupsContext';

export function useGroups() {
  const context = useContext(GroupsContext);
  if (!context) {
    throw new Error('useGroups must be used within a GroupsProvider');
  }
  return context;
}
