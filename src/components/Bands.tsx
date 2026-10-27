import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme";
import { SLOTS } from "../lib/slots";

function Grow({ h, color, delay, highlight }: { h: number; color: string; delay: number; highlight: boolean }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = 0;
    v.value = withDelay(delay, withTiming(h, { duration: 520, easing: Easing.out(Easing.cubic) }));
  }, [h, delay]);
  const st = useAnimatedStyle(() => ({ height: v.value }));
  return <Animated.View style={[{ width: "100%", borderRadius: 4, backgroundColor: color, opacity: highlight ? 1 : 0.85 }, st]} />;
}

// Полоска суток из 12 окон: высота — значение окна (темп/доля перекусов),
// текущее окно отмечено. Подписи — только 6am / noon / 6pm.
export function SlotStrip({ values, color, current, height = 54 }: { values: number[]; color: string; current?: number; height?: number }) {
  const t = useTheme();
  const max = Math.max(...values, 0.0001);
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height, gap: 3 }}>
        {Array.from({ length: SLOTS }, (_, s) => (
          <View key={s} style={{ flex: 1, height, justifyContent: "flex-end", backgroundColor: s === current ? t.colors.accentSoft : "transparent", borderRadius: 4 }}>
            <Grow h={Math.max(2, (values[s] / max) * (height - 4))} color={color} delay={s * 35} highlight={s === current} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {["12am", "6am", "noon", "6pm", "12am"].map((l, i) => (
          <Text key={`${l}${i}`} style={{ ...t.typography.caption, fontSize: 10, color: t.colors.inkFaint }}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

// Этикетка против проверок: шкала ккал, отметка этикетки, оценка модели и
// полоса ± разброс одной порции; точки — сами проверки.
export function PortionBand({ label, mean, sd, checks, unit }: { label: number; mean: number; sd: number; checks: number[]; unit: string }) {
  const t = useTheme();
  const lo = Math.max(0, Math.min(label, mean - 2 * sd, ...checks) * 0.85);
  const hi = Math.max(label, mean + 2 * sd, ...checks) * 1.08;
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%` as const;
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = 0;
    w.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [mean, sd]);
  const band = useAnimatedStyle(() => ({ opacity: w.value, transform: [{ scaleX: w.value }] }));
  return (
    <View style={{ gap: 6 }}>
      <View style={{ height: 34, justifyContent: "center" }}>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: t.colors.backgroundAlt }} />
        <Animated.View style={[{ position: "absolute", left: x(mean - sd), width: `${((2 * sd) / (hi - lo)) * 100}%`, height: 16, top: 9, borderRadius: 8, backgroundColor: t.colors.accentSoft }, band]} />
        {checks.map((v, i) => (
          <View key={i} style={{ position: "absolute", left: x(v), top: 13, width: 8, height: 8, marginLeft: -4, borderRadius: 4, backgroundColor: t.colors.amber }} />
        ))}
        <View style={{ position: "absolute", left: x(label), top: 2, width: 2, height: 30, backgroundColor: t.colors.inkFaint }} />
        <View style={{ position: "absolute", left: x(mean), top: 5, width: 4, marginLeft: -2, height: 24, borderRadius: 2, backgroundColor: t.colors.accent }} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>label {Math.round(label)} kcal</Text>
        <Text style={{ ...t.typography.caption, color: t.colors.accent }}>
          your {unit}: {Math.round(mean)} ± {Math.round(sd)}
        </Text>
      </View>
    </View>
  );
}
