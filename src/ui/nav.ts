import { router } from "expo-router";

// Expo Go восстанавливает последний маршрут без истории — back() тогда молча
// ничего не делает, поэтому «назад» всегда через этот хелпер.
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}
