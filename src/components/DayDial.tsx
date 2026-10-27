import { useRef } from "react";
import { View } from "react-native";
import Svg, { Circle, G, Line, Path } from "react-native-svg";
import Animated, { FadeIn } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useTheme } from "../theme";
import { SLOTS } from "../lib/slots";
import { haptics } from "../services/haptics";

export type DialDot = { minute: number; kcal: number; color: string };
export type DialPlan = { slot: number; color: string };

const TAU = Math.PI * 2;
const angleOf = (minute: number) => (minute / 1440) * TAU - Math.PI / 2;

function arc(cx: number, r: number, a0: number, a1: number) {
  const x0 = cx + r * Math.cos(a0);
  const y0 = cx + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cx + r * Math.sin(a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
}

// Циферблат суток: полночь сверху. Внешнее кольцо — двухчасовые окна,
// насыщенность — как часто в этом окне обычно тянет перекусить (модель темпа).
// Точки — съеденное (размер ∝ ккал), полые кружки — план, стрелка — сейчас.
// Жест: ведёшь пальцем по кольцу — выбирается окно, отпускаешь — выбор
// остаётся; тап в центр снимает выбор.
export function DayDial({ size, rates, dots, planned, minute, selected, onSelect, children }: { size: number; rates: number[]; dots: DialDot[]; planned: DialPlan[]; minute: number; selected: number | null; onSelect: (s: number | null) => void; children?: React.ReactNode }) {
  const t = useTheme();
  const c = size / 2;
  const R = c - 18;
  const inner = R - 26;
  const maxRate = Math.max(...rates, 0.05);
  const last = useRef<number | null>(selected);

  const pick = (x: number, y: number, final: boolean) => {
    const dx = x - c;
    const dy = y - c;
    const d = Math.hypot(dx, dy);
    if (d < inner - 18) {
      if (final) {
        last.current = null;
        onSelect(null);
      }
      return;
    }
    let a = Math.atan2(dy, dx) + Math.PI / 2;
    if (a < 0) a += TAU;
    const s = Math.min(SLOTS - 1, Math.floor((a / TAU) * SLOTS));
    if (s !== last.current) {
      last.current = s;
      haptics.tick();
      onSelect(s);
    }
  };
  const pan = Gesture.Pan()
    .minDistance(2)
    .onBegin((e) => runOnJS(pick)(e.x, e.y, false))
    .onUpdate((e) => runOnJS(pick)(e.x, e.y, false));
  const tap = Gesture.Tap().onEnd((e) => runOnJS(pick)(e.x, e.y, true));

  const nowA = angleOf(minute);
  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <View style={{ width: size, height: size, alignSelf: "center" }} accessibilityLabel="Day dial, drag around the ring to pick a time window">
        <Animated.View entering={FadeIn.duration(500)}>
          <Svg width={size} height={size}>
            {Array.from({ length: SLOTS }, (_, s) => {
              const a0 = (s / SLOTS) * TAU - Math.PI / 2 + 0.03;
              const a1 = ((s + 1) / SLOTS) * TAU - Math.PI / 2 - 0.03;
              const on = selected === s;
              return (
                <Path
                  key={`s${s}`}
                  d={arc(c, R, a0, a1)}
                  stroke={on ? t.colors.ink : t.colors.accent}
                  strokeOpacity={on ? 0.9 : 0.1 + 0.75 * (rates[s] / maxRate)}
                  strokeWidth={on ? 20 : 15}
                  strokeLinecap="butt"
                  fill="none"
                />
              );
            })}
            <Circle cx={c} cy={c} r={inner} stroke={t.colors.border} strokeWidth={1} strokeDasharray="2 6" fill="none" />
            {[0, 6, 12, 18].map((h) => {
              const a = angleOf(h * 60);
              return <Line key={`h${h}`} x1={c + (inner - 6) * Math.cos(a)} y1={c + (inner - 6) * Math.sin(a)} x2={c + (inner + 4) * Math.cos(a)} y2={c + (inner + 4) * Math.sin(a)} stroke={t.colors.inkFaint} strokeWidth={2} />;
            })}
            {planned.map((p, i) => {
              const a = angleOf(p.slot * 120 + 60);
              return <Circle key={`p${i}`} cx={c + inner * Math.cos(a)} cy={c + inner * Math.sin(a)} r={8} stroke={p.color} strokeWidth={2.5} strokeDasharray="3 2.5" fill={t.colors.surface} />;
            })}
            {dots.map((d, i) => {
              const a = angleOf(d.minute);
              return <Circle key={`d${i}`} cx={c + inner * Math.cos(a)} cy={c + inner * Math.sin(a)} r={Math.min(13, 5 + d.kcal / 30)} fill={d.color} stroke={t.colors.surface} strokeWidth={2} />;
            })}
            <G>
              <Line x1={c + (inner - 14) * Math.cos(nowA)} y1={c + (inner - 14) * Math.sin(nowA)} x2={c + (R + 12) * Math.cos(nowA)} y2={c + (R + 12) * Math.sin(nowA)} stroke={t.colors.ink} strokeWidth={3} strokeLinecap="round" />
              <Circle cx={c + (R + 12) * Math.cos(nowA)} cy={c + (R + 12) * Math.sin(nowA)} r={4} fill={t.colors.ink} />
            </G>
          </Svg>
        </Animated.View>
        <View pointerEvents="none" style={{ position: "absolute", left: c - inner + 16, top: c - inner + 16, width: (inner - 16) * 2, height: (inner - 16) * 2, alignItems: "center", justifyContent: "center" }}>
          {children}
        </View>
      </View>
    </GestureDetector>
  );
}
