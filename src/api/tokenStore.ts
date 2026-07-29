import { TokenPair } from '../types/api';

let tokens: TokenPair | null = null;
let refreshed: ((next: TokenPair) => void) | null = null;
let expired: (() => void) | null = null;

export function configureApiSession(
  nextTokens: TokenPair | null,
  onRefreshed: (next: TokenPair) => void,
  onExpired: () => void,
) {
  tokens = nextTokens;
  refreshed = onRefreshed;
  expired = onExpired;
}

export function getApiAccessToken() {
  return tokens?.accessToken ?? null;
}

export function getApiRefreshToken() {
  return tokens?.refreshToken ?? null;
}

export function updateApiTokens(next: TokenPair) {
  tokens = next;
  refreshed?.(next);
}

export function expireApiSession() {
  tokens = null;
  expired?.();
}
