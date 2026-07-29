import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'hearo.local.chat-links';

type ChatLinks = Record<string, number>;

export async function loadChatLinks(): Promise<ChatLinks> {
  const value = await AsyncStorage.getItem(STORAGE_KEY);
  if (!value) return {};
  try {
    return JSON.parse(value) as ChatLinks;
  } catch {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return {};
  }
}

export async function rememberChatLink(requestId: number, chatRoomId: number) {
  const links = await loadChatLinks();
  links[String(requestId)] = chatRoomId;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(links));
  return links;
}
