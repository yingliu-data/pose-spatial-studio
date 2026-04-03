import { create } from 'zustand';
import {
  type AppFunction,
  type FunctionDefinition,
  type ProcessorType,
  FUNCTION_DEFINITIONS,
} from '@/types/functions';
import { type BackendResult } from '@/types/pose';

export type RendererType = 'avatar' | 'stickball';

interface AppState {
  // Function selection
  activeFunction: AppFunction | null;
  functionDef: FunctionDefinition | null;

  // Source configuration
  sourceType: 'camera' | 'video';
  deviceId: string;
  deviceLabel: string;
  videoFile: File | null;

  // Stream lifecycle
  isStreamActive: boolean;
  isInitializing: boolean;
  initMessage: string;

  // Latest backend result
  backendResult: BackendResult | null;

  // UI state
  sidebarCollapsed: boolean;
  rightSidebarCollapsed: boolean;
  rendererType: RendererType;
  pose3dProcessorType: ProcessorType;

  // Actions
  selectFunction: (fn: AppFunction) => void;
  clearFunction: () => void;
  setSourceConfig: (
    sourceType: 'camera' | 'video',
    deviceId: string,
    deviceLabel: string,
    videoFile?: File | null,
  ) => void;
  setStreamActive: (active: boolean) => void;
  setInitializing: (init: boolean, message?: string) => void;
  setInitMessage: (message: string) => void;
  setBackendResult: (result: BackendResult | null) => void;
  toggleSidebar: () => void;
  toggleRightSidebar: () => void;
  toggleRendererType: () => void;
  setPose3dProcessorType: (type: ProcessorType) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeFunction: null,
  functionDef: null,
  sourceType: 'camera',
  deviceId: '',
  deviceLabel: '',
  videoFile: null,
  isStreamActive: false,
  isInitializing: false,
  initMessage: '',
  backendResult: null,
  sidebarCollapsed: false,
  rightSidebarCollapsed: true,
  rendererType: 'stickball',
  pose3dProcessorType: 'mediapipe',

  selectFunction: (fn) =>
    set({
      activeFunction: fn,
      functionDef: FUNCTION_DEFINITIONS.find((d) => d.id === fn) ?? null,
      // Reset stream state when switching functions
      isStreamActive: false,
      isInitializing: false,
      initMessage: '',
      backendResult: null,
    }),

  clearFunction: () =>
    set({
      activeFunction: null,
      functionDef: null,
      isStreamActive: false,
      isInitializing: false,
      initMessage: '',
      backendResult: null,
    }),

  setSourceConfig: (sourceType, deviceId, deviceLabel, videoFile) =>
    set({ sourceType, deviceId, deviceLabel, videoFile: videoFile ?? null }),

  setStreamActive: (active) => set({ isStreamActive: active }),

  setInitializing: (init, message) =>
    set({ isInitializing: init, initMessage: message ?? '' }),

  setInitMessage: (message) => set({ initMessage: message }),

  setBackendResult: (result) => set({ backendResult: result }),

  toggleSidebar: () =>
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  toggleRightSidebar: () =>
    set((s) => ({ rightSidebarCollapsed: !s.rightSidebarCollapsed })),

  toggleRendererType: () =>
    set((s) => ({
      rendererType: s.rendererType === 'avatar' ? 'stickball' : 'avatar',
    })),

  setPose3dProcessorType: (type) => set({ pose3dProcessorType: type }),
}));
