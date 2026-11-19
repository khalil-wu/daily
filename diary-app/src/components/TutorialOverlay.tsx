import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Check, Heart, Pin, Trash2 } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { actions, openTutorial, type TourKind } from '../store/store';
import { Button, haptic } from './ui';
import { EntryListCard } from './EntryCard';
import { SwipeRow, type SwipeRowHandle } from './SwipeRow';
import { ND, SPRING, prefersReducedMotion } from './motion';
import { measureTourTargets, measureView, runTourHandler, type TourRect } from './tour';

/* ---------------- 导览脚本 ---------------- */

interface TourStep {
  key: string;
  /** 短标签，显示在卡片左上角 */
  tag: string;
  title: string;
  desc: string;
  /** 要打光的真实控件（登记在 tour.ts 里）；不填则卡片居中显示 */
  targets?: string[];
  /** 目标不在屏幕上时跳过这一步（例如还没有日记时的「今日」卡片） */
  optional?: boolean;
  /** 光圈比控件多出来的留白 */
  pad?: number;
  radius?: number;
  /** 卡片里附带的可交互演示 */
  demo?: 'swipe';
}

const HOME_STEPS: TourStep[] = [
  {
    key: 'welcome',
    tag: '新手导览',
    title: '一分钟，认识记得日记',
    desc: '跟着光圈走一遍，就能上手记录、整理和回看。\n随时可以跳过，之后可在「我的」里重看。',
  },
  {
    key: 'fab',
    tag: '开始记录',
    title: '从这里写下第一篇',
    desc: '点「＋」可以直接写日记，也可以用模板、录音或拍照开始。',
    targets: ['home.fab'],
    pad: 8,
    radius: 999,
  },
  {
    key: 'today',
    tag: '今日',
    title: '每天一张小卡片',
    desc: '点一个心情就能开始写；不知道写什么时，试试今日灵感。写完后这里会收起，只留今日进度和连续天数。',
    targets: ['home.today'],
    optional: true,
    pad: 4,
    radius: 18,
  },
  {
    key: 'title',
    tag: '整理',
    title: '日记本与筛选',
    desc: '点标题可以切换日记本、按心情或标签筛选，还能进入草稿箱、收藏和最近删除。',
    targets: ['home.title'],
    pad: 8,
    radius: 14,
  },
  {
    key: 'tools',
    tag: '查找',
    title: '搜索与视图切换',
    desc: '搜索会翻遍标题、正文和标签；右边的按钮在「列表 / 卡片」两种视图之间切换。',
    targets: ['home.tools'],
    pad: 4,
    radius: 14,
  },
  {
    key: 'swipe',
    tag: '手势',
    title: '左滑与长按',
    desc: '向左滑动日记卡片可以置顶、收藏或删除；长按还能移动到别的日记本。删除后 30 天内都能找回。',
    demo: 'swipe',
  },
  {
    key: 'look-back',
    tag: '回看',
    title: '日历与回顾',
    desc: '「日历」按日期看心情印记，还能补记某一天；「回顾」用时间线和那年今日重温过去。',
    targets: ['tab.calendar', 'tab.review'],
    pad: -3,
    radius: 16,
  },
  {
    key: 'insight',
    tag: '洞察与守护',
    title: '统计与我的',
    desc: '「统计」呈现情绪和写作习惯；「我的」里有应用锁、备份恢复和导入导出，守护你的记录。',
    targets: ['tab.stats', 'tab.me'],
    pad: -3,
    radius: 16,
  },
  {
    key: 'done',
    tag: '完成',
    title: '准备好了',
    desc: '现在就写下今天的一句话吧，\n哪怕只有一行，也是值得记住的一天。',
  },
];

const EDITOR_STEPS: TourStep[] = [
  {
    key: 'meta',
    tag: '记录信息',
    title: '先给这一刻做个标记',
    desc: '日记本、时间、心情、天气地点和标签都在这一行，左右滑动查看。点时间可以补记过去的某一天。',
    targets: ['write.meta'],
    pad: 4,
    radius: 18,
  },
  {
    key: 'body',
    tag: '正文',
    title: '想到什么就写什么',
    desc: '内容每隔几秒自动存为草稿，不怕丢。写列表、待办或引用时，回车会自动接上下一项。',
    targets: ['write.body'],
    pad: 6,
    radius: 14,
  },
  {
    key: 'format',
    tag: '排版',
    title: '撤销、格式与预览',
    desc: '点左下角「Aa」展开格式工具：撤销重做、小标题、加粗、待办、分割线都在这里；右下角的眼睛可以预览排版。',
    targets: ['write.format'],
    pad: 2,
    radius: 12,
  },
  {
    key: 'attach',
    tag: '多媒体',
    title: '照片、视频、录音与听写',
    desc: '这一排依次是图片、视频、录音、听写、地点天气、标签和心情；设备支持时，说出来的话会直接变成文字。',
    targets: ['write.attach'],
    pad: 2,
    radius: 12,
  },
  {
    key: 'publish',
    tag: '完成',
    title: '写好就发布',
    desc: '发布后会出现在首页和日历里。中途点「取消」，也会提醒你要不要存为草稿。',
    targets: ['write.publish'],
    pad: 8,
    radius: 999,
  },
];

/** 回到首页并开始首页导览（从「我的」「帮助」「关于」等任何页面都可以调用） */
export function startHomeTour() {
  try {
    if (router.canDismiss()) router.dismissAll();
  } catch {
    // 已经在根页面
  }
  router.navigate('/(tabs)');
  setTimeout(() => openTutorial('home'), 420);
}

/* ---------------- 小工具 ---------------- */

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function lerpRect(a: TourRect, b: TourRect, p: number): TourRect {
  return {
    x: a.x + (b.x - a.x) * p,
    y: a.y + (b.y - a.y) * p,
    w: a.w + (b.w - a.w) * p,
    h: a.h + (b.h - a.h) * p,
  };
}

function inflate(r: TourRect, by: number): TourRect {
  return { x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 };
}

/** 整屏遮罩 + 一个圆角矩形镂空（evenodd） */
function maskPath(W: number, H: number, r: TourRect | null, rad: number) {
  const outer = `M0 0H${W}V${H}H0Z`;
  if (!r || r.w <= 1 || r.h <= 1) return outer;
  const rr = Math.max(0, Math.min(rad, r.w / 2, r.h / 2));
  const { x, y, w, h } = r;
  return (
    `${outer}M${x + rr} ${y}H${x + w - rr}A${rr} ${rr} 0 0 1 ${x + w} ${y + rr}V${y + h - rr}` +
    `A${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}H${x + rr}A${rr} ${rr} 0 0 1 ${x} ${y + h - rr}V${y + rr}` +
    `A${rr} ${rr} 0 0 1 ${x + rr} ${y}Z`
  );
}

/** 翻开的书本 + 光芒（沿用原教程弹窗顶部的图标） */
function TutorialBookIcon({ primary, soft, page }: { primary: string; soft: string; page: string }) {
  return (
    <Svg width={64} height={54} viewBox="0 0 64 54">
      <Path
        d="M8 17 C8 14.5 10 13 12.5 13 C19 13 26.5 14.5 31 18.5 L31 44 C26.5 40.5 19 39.5 12 39.5 C9.8 39.5 8 38 8 35.8 Z"
        fill={soft}
        stroke={primary}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path
        d="M54 17 C54 14.5 52 13 49.5 13 C43 13 35.5 14.5 31 18.5 L31 44 C35.5 40.5 43 39.5 50 39.5 C52.2 39.5 54 38 54 35.8 Z"
        fill={page}
        stroke={primary}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path d="M14 22 L25 23.5 M14 28 L25 29.5 M37 23.5 L48 22 M37 29.5 L48 28" stroke={primary} strokeWidth={1.4} strokeLinecap="round" opacity={0.55} />
      <Path d="M51 7 L51 2.5 M56.5 10 L60 7 M58.5 15 L63 14.5" stroke={primary} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** 手势演示：一张真实的日记卡片，可以真的左滑 */
function SwipeDemo() {
  const { c, fs } = useTheme();
  const rowRef = useRef<SwipeRowHandle>(null);
  const [done, setDone] = useState(false);
  const entry = useMemo(
    () =>
      actions.newEntry({
        id: 'tour_demo',
        title: '傍晚散步',
        body: '风很温柔，路过花店买了一小束雏菊。',
        mood: 'calm',
        tags: ['life'],
        status: 'published',
      }),
    [],
  );

  useEffect(() => {
    const timer = setTimeout(() => rowRef.current?.peek(), 650);
    return () => clearTimeout(timer);
  }, []);

  const finish = () => {
    haptic('success');
    setDone(true);
  };

  return (
    <View style={{ marginTop: 14 }}>
      <View style={{ borderRadius: 16, overflow: 'hidden' }}>
        <SwipeRow
          ref={rowRef}
          onOpenChange={open => {
            if (open) finish();
          }}
          actions={[
            { key: 'pin', label: '置顶', icon: Pin, color: c.primaryDark, onPress: finish },
            { key: 'fav', label: '收藏', icon: Heart, color: c.warning, onPress: finish },
            { key: 'del', label: '删除', icon: Trash2, color: c.danger, onPress: finish },
          ]}
        >
          <EntryListCard entry={entry} noMargin onPress={() => rowRef.current?.peek()} onLongPress={finish} />
        </SwipeRow>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10, height: 18 }}>
        {done && <Check size={13} color={c.success} strokeWidth={3} />}
        <Text style={{ fontSize: fs(12), color: done ? c.success : c.textSub, fontWeight: done ? '600' : '400' }}>
          {done ? '就是这样，你已经学会了' : '试着向左滑动这张卡片'}
        </Text>
      </View>
    </View>
  );
}

/* ---------------- 导览浮层 ---------------- */

export function TutorialOverlay({ tour, onFinish }: { tour: TourKind | null; onFinish: (tour: TourKind, completed: boolean) => void }) {
  if (!tour) return null;
  return <TourRunner key={tour} tour={tour} onFinish={onFinish} />;
}

function TourRunner({ tour, onFinish }: { tour: TourKind; onFinish: (tour: TourKind, completed: boolean) => void }) {
  const { c, t, fs, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const steps = tour === 'home' ? HOME_STEPS : EDITOR_STEPS;

  const [idx, setIdx] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hole, setHole] = useState<TourRect | null>(null);
  const [target, setTarget] = useState<TourRect | null>(null);
  const [cardH, setCardH] = useState(0);
  const [busy, setBusy] = useState(true);

  const rootRef = useRef<View>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const cardA = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const holeRef = useRef<TourRect | null>(null);
  const holeAnim = useRef<Animated.CompositeAnimation | null>(null);
  const runId = useRef(0);
  const closing = useRef(false);
  const idxRef = useRef(0);
  idxRef.current = idx;

  const step = steps[idx];
  const isLast = idx === steps.length - 1;
  const centered = !target;

  /* —— 光圈在两步之间平滑移动 —— */
  const moveHole = useCallback((to: TourRect | null) => {
    holeAnim.current?.stop();
    const from = holeRef.current;
    if (!from && !to) {
      setHole(null);
      return;
    }
    if (prefersReducedMotion()) {
      holeRef.current = to;
      setHole(to);
      return;
    }
    // 从居中卡片进入聚光：光圈由外向内收拢；离开聚光：光圈向中心合上
    const start = from ?? inflate(to!, 44);
    const end = to ?? { x: from!.x + from!.w / 2, y: from!.y + from!.h / 2, w: 0, h: 0 };
    const p = new Animated.Value(0);
    const sub = p.addListener(({ value }) => {
      const r = lerpRect(start, end, value);
      holeRef.current = r;
      setHole(r);
    });
    const anim = Animated.timing(p, { toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    holeAnim.current = anim;
    anim.start(({ finished }) => {
      p.removeListener(sub);
      if (finished) {
        holeRef.current = to;
        setHole(to);
      }
    });
  }, []);

  /* —— 量出某一步的目标位置（相对浮层自身），页面转场时多试几次 —— */
  const measureStep = useCallback(async (st: TourStep): Promise<TourRect | null> => {
    if (!st.targets) return null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const [origin, r] = await Promise.all([measureView(rootRef.current), measureTourTargets(st.targets)]);
      if (origin && r) {
        const pad = st.pad ?? 6;
        return inflate({ x: r.x - origin.x, y: r.y - origin.y, w: r.w, h: r.h }, pad);
      }
      await sleep(70);
    }
    return null;
  }, []);

  const finish = useCallback(
    (completed: boolean, after?: () => void) => {
      if (closing.current) return;
      closing.current = true;
      runId.current += 1;
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: ND }).start(() => {
        onFinish(tour, completed);
        after?.();
      });
    },
    [fade, onFinish, tour],
  );

  /* —— 切换到某一步：卡片淡出 → 量位置 → 光圈移动 → 卡片淡入 —— */
  const go = useCallback(
    async (next: number, dir: 1 | -1) => {
      if (closing.current) return;
      const my = ++runId.current;
      setBusy(true);
      await new Promise<void>(resolve => {
        Animated.timing(cardA, { toValue: 0, duration: 110, useNativeDriver: ND }).start(() => resolve());
      });
      if (my !== runId.current) return;

      let i = next;
      let rect: TourRect | null = null;
      while (i >= 0 && i < steps.length) {
        const st = steps[i];
        if (!st.targets) break;
        rect = await measureStep(st);
        if (my !== runId.current) return;
        if (rect || !st.optional) break;
        i += dir;
      }
      if (i >= steps.length) {
        finish(true);
        return;
      }
      if (i < 0) i = 0;

      setIdx(i);
      setTarget(rect);
      moveHole(rect);
      // 留两帧给卡片按新内容重新排版，再淡入
      await sleep(90);
      if (my !== runId.current) return;
      Animated.spring(cardA, { toValue: 1, useNativeDriver: ND, ...SPRING.pop }).start();
      setBusy(false);
    },
    [cardA, finish, measureStep, moveHole, steps],
  );

  useEffect(() => {
    runTourHandler(tour === 'home' ? 'home.prepare' : 'editor.prepare');
    Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: ND }).start();
    void go(0, 1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: ND }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: ND }),
      ]),
    );
    if (!prefersReducedMotion()) loop.start();
    return () => {
      runId.current += 1;
      loop.stop();
      holeAnim.current?.stop();
    };
    // 只在挂载时启动一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Android 返回键：回到上一步，第一步时等同于跳过
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (idxRef.current > 0) void go(idxRef.current - 1, -1);
      else finish(false);
      return true;
    });
    return () => sub.remove();
  }, [finish, go]);

  const next = () => {
    if (busy) return;
    haptic('light');
    if (isLast) finish(true);
    else void go(idx + 1, 1);
  };
  const prev = () => {
    if (busy || idx === 0) return;
    haptic('light');
    void go(idx - 1, -1);
  };
  const skip = () => {
    haptic('light');
    finish(false);
  };

  /* —— 卡片位置：贴着光圈的上方或下方，水平方向尽量对准 —— */
  const W = size.w;
  const H = size.h;
  const cardW = Math.min(Math.max(W - 32, 0), 344);
  let cardLeft = (W - cardW) / 2;
  let cardTop = Math.max(insets.top + 12, (H - cardH) / 2);
  let below = true;
  let caretX = cardW / 2 - 7;
  if (target && W > 0) {
    const spaceBelow = H - (target.y + target.h);
    const spaceAbove = target.y;
    below = spaceBelow >= cardH + 30 || spaceBelow >= spaceAbove;
    cardTop = below ? target.y + target.h + 16 : target.y - cardH - 16;
    cardTop = Math.min(Math.max(cardTop, insets.top + 8), Math.max(insets.top + 8, H - cardH - Math.max(insets.bottom, 8)));
    const cx = target.x + target.w / 2;
    cardLeft = Math.min(Math.max(cx - cardW / 2, 16), W - cardW - 16);
    caretX = Math.min(Math.max(cx - cardLeft - 7, 22), cardW - 36);
  }

  const dim = dark ? 'rgba(0,0,0,0.72)' : 'rgba(34,29,25,0.62)';
  const holeRadius = step.radius ?? 14;
  const ringRadius = hole ? Math.min(holeRadius, hole.w / 2, hole.h / 2) : 0;

  return (
    <Animated.View
      ref={rootRef}
      collapsable={false}
      onLayout={e => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      onStartShouldSetResponder={() => true}
      accessibilityViewIsModal
      style={[StyleSheet.absoluteFill, { zIndex: 95, opacity: fade }]}
    >
      {/* 遮罩：真实控件的位置被镂空出来 */}
      {W > 0 && (
        <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path d={maskPath(W, H, hole, holeRadius)} fill={dim} fillRule="evenodd" />
        </Svg>
      )}

      {/* 光圈描边（呼吸），点一下光圈里的控件也可以前进 */}
      {hole && hole.w > 2 && (
        <>
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: hole.x,
              top: hole.y,
              width: hole.w,
              height: hole.h,
              borderRadius: ringRadius,
              borderWidth: 2,
              borderColor: '#FFFFFF',
              shadowColor: '#FFFFFF',
              shadowOpacity: 0.9,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 0 },
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }),
            }}
          />
          <Pressable
            onPress={next}
            accessibilityLabel="下一步"
            style={{ position: 'absolute', left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: ringRadius }}
          />
        </>
      )}

      {/* 说明卡片 */}
      {W > 0 && (
        <Animated.View
          onLayout={e => setCardH(e.nativeEvent.layout.height)}
          style={{
            position: 'absolute',
            left: cardLeft,
            top: cardTop,
            width: cardW,
            backgroundColor: c.card,
            borderRadius: 20,
            padding: 18,
            opacity: cardA.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
            transform: [
              { translateY: cardA.interpolate({ inputRange: [0, 1], outputRange: [centered ? 10 : below ? -8 : 8, 0] }) },
              { scale: cardA.interpolate({ inputRange: [0, 1], outputRange: [centered ? 0.96 : 1, 1] }) },
            ],
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 10 },
            elevation: 12,
          }}
        >
          {!centered && (
            <View
              style={{
                position: 'absolute',
                left: caretX,
                ...(below ? { top: -6 } : { bottom: -6 }),
                width: 14,
                height: 14,
                borderRadius: 3,
                backgroundColor: c.card,
                transform: [{ rotate: '45deg' }],
              }}
            />
          )}

          {centered && !step.demo ? (
            <View style={{ alignItems: 'center' }}>
              <View style={{ marginTop: 4, marginBottom: 10 }}>
                <TutorialBookIcon primary={c.primary} soft={c.primaryFaint} page={c.card} />
              </View>
              <Text style={[t.h2, { fontSize: fs(20), textAlign: 'center' }]}>{step.title}</Text>
              <Text style={{ fontSize: fs(13.5), color: c.textSub, textAlign: 'center', lineHeight: fs(13.5) * 1.7, marginTop: 10 }}>{step.desc}</Text>
            </View>
          ) : (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: c.primaryFaint }}>
                  <Text style={{ fontSize: fs(11.5), color: c.primaryDark, fontWeight: '600' }}>{step.tag}</Text>
                </View>
                <Pressable hitSlop={12} onPress={skip} accessibilityLabel="跳过导览">
                  <Text style={{ fontSize: fs(12.5), color: c.textMuted }}>跳过</Text>
                </Pressable>
              </View>
              <Text style={[t.h2, { fontSize: fs(17.5), marginTop: 12 }]}>{step.title}</Text>
              <Text style={{ fontSize: fs(13.5), color: c.textSub, lineHeight: fs(13.5) * 1.7, marginTop: 6 }}>{step.desc}</Text>
              {step.demo === 'swipe' && <SwipeDemo />}
            </View>
          )}

          {/* 进度点 + 操作 */}
          {centered && !step.demo ? (
            <View style={{ marginTop: 18 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
                {steps.map((s, i) => (
                  <View key={s.key} style={{ width: i === idx ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === idx ? c.primary : c.primarySoft }} />
                ))}
              </View>
              {idx === 0 ? (
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Button title="跳过" variant="secondary" size="md" onPress={skip} style={{ flex: 1 }} />
                  <Button title="开始" size="md" onPress={next} style={{ flex: 1 }} />
                </View>
              ) : isLast && tour === 'home' ? (
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Button title="先逛逛" variant="secondary" size="md" onPress={() => finish(true)} style={{ flex: 1 }} />
                  <Button title="写一篇日记" size="md" onPress={() => finish(true, () => router.push('/write'))} style={{ flex: 1 }} />
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Button title="上一步" variant="secondary" size="md" onPress={prev} style={{ flex: 1 }} />
                  <Button title={isLast ? '完成' : '下一步'} size="md" onPress={next} style={{ flex: 1 }} />
                </View>
              )}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
              <View style={{ flex: 1, flexDirection: 'row', gap: 5 }}>
                {steps.map((s, i) => (
                  <View key={s.key} style={{ width: i === idx ? 14 : 5, height: 5, borderRadius: 3, backgroundColor: i === idx ? c.primary : c.primarySoft }} />
                ))}
              </View>
              {idx > 0 && <Button title="上一步" variant="ghost" size="md" full={false} onPress={prev} style={{ paddingHorizontal: 14 }} />}
              <Button title={isLast ? '开始写作' : '下一步'} size="md" full={false} onPress={next} style={{ paddingHorizontal: 20 }} />
            </View>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
}
