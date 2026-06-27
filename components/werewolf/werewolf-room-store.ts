import { create } from "zustand";
import type { getWerewolfRoomState } from "@/app/actions/werewolf";
import { getWerewolfRoomView, syncGameParticipants, type WerewolfGameState, type WerewolfRoomView } from "@/lib/werewolf/game-state";
import type { WerewolfDevPatches } from "./werewolf-dev-tools";

type RoomState = Awaited<ReturnType<typeof getWerewolfRoomState>>;
type Updater<T> = T | ((previous: T) => T);

type WerewolfRoomStore = {
  rawState: RoomState;
  gameState: WerewolfGameState | null;
  devPatches: WerewolfDevPatches;
  loaded: boolean;
  name: string;
  message: string;
  copied: boolean;
  now: number;
  playerLimitInput: number;
  nightInput: number;
  dayInput: number;
  votingInput: number;
  revoteInput: number;
  setDevPatches: (patches: Updater<WerewolfDevPatches>) => void;
  setGameState: (gameState: WerewolfGameState | null) => void;
  updateGameState: (updater: (gameState: WerewolfGameState | null, room: WerewolfRoomView | null) => WerewolfGameState | null) => WerewolfGameState | null;
  setName: (name: string) => void;
  setMessage: (message: string) => void;
  setCopied: (copied: boolean) => void;
  setNow: (now: number) => void;
  setPlayerLimitInput: (value: number) => void;
  setNightInput: (value: number) => void;
  setDayInput: (value: number) => void;
  setVotingInput: (value: number) => void;
  setRevoteInput: (value: number) => void;
  applyRoomState: (state: RoomState, options?: { initializeTimers?: boolean }) => void;
  resetRoomUi: () => void;
};

const initialState = {
  rawState: null,
  gameState: null,
  devPatches: {},
  loaded: false,
  name: "",
  message: "",
  copied: false,
  now: Date.now(),
  playerLimitInput: 10,
  nightInput: 60,
  dayInput: 120,
  votingInput: 60,
  revoteInput: 30,
} satisfies Pick<
  WerewolfRoomStore,
  | "rawState"
  | "gameState"
  | "devPatches"
  | "loaded"
  | "name"
  | "message"
  | "copied"
  | "now"
  | "playerLimitInput"
  | "nightInput"
  | "dayInput"
  | "votingInput"
  | "revoteInput"
>;

export const useWerewolfRoomStore = create<WerewolfRoomStore>((set) => ({
  ...initialState,
  setDevPatches: (devPatches) =>
    set((state) => ({
      devPatches: typeof devPatches === "function" ? devPatches(state.devPatches) : devPatches,
    })),
  setGameState: (gameState) =>
    set((state) => {
      if (state.gameState && gameState && gameState.updatedAt < state.gameState.updatedAt) return state;
      return { gameState };
    }),
  updateGameState: (updater) => {
    let nextGameState: WerewolfGameState | null = null;
    set((state) => {
      const room = state.rawState ? getWerewolfRoomView(state.rawState, state.gameState) : null;
      nextGameState = updater(state.gameState, room);
      return { gameState: nextGameState };
    });
    return nextGameState;
  },
  setName: (name) => set({ name }),
  setMessage: (message) => set({ message }),
  setCopied: (copied) => set({ copied }),
  setNow: (now) => set({ now }),
  setPlayerLimitInput: (playerLimitInput) => set({ playerLimitInput }),
  setNightInput: (nightInput) => set({ nightInput }),
  setDayInput: (dayInput) => set({ dayInput }),
  setVotingInput: (votingInput) => set({ votingInput }),
  setRevoteInput: (revoteInput) => set({ revoteInput }),
  applyRoomState: (rawState, options) =>
    set((state) => ({
      rawState,
      loaded: true,
      gameState: rawState && state.gameState ? syncGameParticipants(state.gameState, rawState) : state.gameState,
      ...(rawState
        ? {
            playerLimitInput: rawState.playerLimit,
            ...(options?.initializeTimers && rawState.status === "Lobby"
              ? {
                  nightInput: rawState.nightSeconds,
                  dayInput: rawState.daySeconds,
                  votingInput: rawState.votingSeconds,
                  revoteInput: rawState.revoteSeconds,
                }
              : null),
          }
        : null),
    })),
  resetRoomUi: () => set({ ...initialState, now: Date.now() }),
}));
