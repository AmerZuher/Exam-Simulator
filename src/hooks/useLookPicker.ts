import { useContext } from 'react';
import { LookPickerContext } from '../contexts/LookPickerContext';

export function useLookPicker() {
  const context = useContext(LookPickerContext);
  if (!context) {
    throw new Error('useLookPicker must be used within a LookPickerProvider');
  }
  return context;
}
