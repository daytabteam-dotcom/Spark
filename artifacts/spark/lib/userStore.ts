import AsyncStorage from "@react-native-async-storage/async-storage";

const USER_KEY = "spark.userId";
const CHAR_KEY = "spark.selectedCharacterId";

export async function getStoredUserId(): Promise<string | null> {
  return AsyncStorage.getItem(USER_KEY);
}

export async function setStoredUserId(id: string): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, id);
}

export async function clearStoredUser(): Promise<void> {
  await AsyncStorage.multiRemove([USER_KEY, CHAR_KEY]);
}

export async function getStoredCharacterId(): Promise<string | null> {
  return AsyncStorage.getItem(CHAR_KEY);
}

export async function setStoredCharacterId(id: string): Promise<void> {
  await AsyncStorage.setItem(CHAR_KEY, id);
}
