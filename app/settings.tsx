import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Gauge, PiggyBank, RotateCcw, ShieldCheck, Vibrate } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { useApp } from "../src/store/appStore";
import { goBack } from "../src/ui/nav";
import { PressableScale } from "../src/components/PressableScale";
import { Segmented } from "../src/components/Segmented";
import { Stepper } from "../src/components/Bits";
import { Toggle } from "../src/components/Toggle";
import { resetAll, saveSetting } from "../src/data/repo";

// Settings — сетка плиток: каждый параметр своей карточкой с иконкой.
export default function SettingsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, refresh } = useApp();
  const [confirm, setConfirm] = useState(false);
  const save = async (k: string, v: string) => {
    await saveSetting(k, v);
    await refresh();
  };
  const tile = (i: number, icon: React.ReactNode, title: string, note: string, control: React.ReactNode) => (
    <Animated.View key={title} entering={FadeInDown.delay(staggerDelay(i)).duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: t.colors.accentSoft, alignItems: "center", justifyContent: "center" }}>{icon}</View>
        <Text style={{ ...t.typography.label, fontSize: 15, color: t.colors.ink, flex: 1 }}>{title}</Text>
      </View>
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{note}</Text>
      {control}
    </Animated.View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
        <PressableScale accessibilityLabel="Back" onPress={goBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.surface, alignItems: "center", justifyContent: "center" }}>
          <ArrowLeft size={20} color={t.colors.ink} />
        </PressableScale>
        <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 40 }}>
        {tile(0, <Gauge size={18} color={t.colors.accent} />, "Daily snack budget", "Calories for snacks only — meals are not counted here.", <Stepper value={settings.budget} step={25} min={100} max={1500} format={(v) => `${v} kcal`} onChange={(v) => save("budget", String(v))} />)}
        {tile(
          1,
          <ShieldCheck size={18} color={t.colors.accent} />,
          "How sure the plan should be",
          "Higher means a bigger safety margin on portions you haven't checked.",
          <Segmented items={[{ key: "0.7", label: "70%" }, { key: "0.8", label: "80%" }, { key: "0.9", label: "90%" }]} value={settings.target} onChange={(v) => save("target", v)} />
        )}
        {tile(2, <PiggyBank size={18} color={t.colors.accent} />, "Week flex", "Lighter days this week bank up to 150 kcal each, which a heavier day can borrow.", <View style={{ alignItems: "flex-start" }}><Toggle value={settings.flex} onValueChange={(v) => save("flex", v ? "1" : "0")} /></View>)}
        {tile(3, <Vibrate size={18} color={t.colors.accent} />, "Vibration", "Light taps on swipes, ratings and saves.", <View style={{ alignItems: "flex-start" }}><Toggle value={settings.haptics} onValueChange={(v) => save("haptics", v ? "1" : "0")} /></View>)}
        <Animated.View entering={FadeInDown.delay(staggerDelay(4)).duration(400)}>
          <PressableScale
            accessibilityLabel={confirm ? "Tap again to erase" : "Erase all data"}
            onPress={async () => {
              if (!confirm) return setConfirm(true);
              await resetAll();
              await refresh();
              setConfirm(false);
              goBack();
            }}
            style={{ flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 999, backgroundColor: confirm ? t.colors.danger : t.colors.surface }}
          >
            <RotateCcw size={16} color={confirm ? "#FFFFFF" : t.colors.danger} />
            <Text style={{ ...t.typography.label, color: confirm ? "#FFFFFF" : t.colors.danger }}>{confirm ? "Tap again to erase everything" : "Erase all data"}</Text>
          </PressableScale>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
