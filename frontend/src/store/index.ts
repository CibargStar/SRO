/**
 * State Management (Zustand)
 * 
 * Централизованное управление состоянием приложения.
 * Используйте Zustand для глобального состояния, Context API для локального.
 * 
 * @example
 * ```typescript
 * import { create } from 'zustand';
 * export const useStore = create((set) => ({
 *   count: 0,
 *   increment: () => set((state) => ({ count: state.count + 1 })),
 * }));
 * ```
 */

