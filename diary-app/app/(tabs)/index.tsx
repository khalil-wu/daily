import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../src/components/text';
import { router, useNavigation } from 'expo-router';
import {
  AudioLines, BookOpen, ChevronDown, CloudOff, FileText, FolderInput, Heart,
  Image as ImageIcon, LayoutGrid, List, Lock, Pin, Plus, Search, Trash2, X,
} from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions, inNotebook, openTutorial, useHydrated, useStore } from '../../src/store/store';
import { Chip, EmptyState, IconButton, InkPress, Screen, UnderlineTabs, haptic } from '../../src/components/ui';
import { EntryGridCard, EntryListCard } from '../../src/components/EntryCard';
import { SwipeRow, closeOpenSwipeRow, type SwipeAction } from '../../src/components/SwipeRow';
import { TodayCard } from '../../src/components/TodayCard';
import { OnThisDay } from '../../src/components/OnThisDay';
import { animateNextLayout, BottomSheet, CrumpleRow, FadeIn, ND, PressableScale, useReducedMotion, SPRING } from '../../src/components/motion';
import { setTourHandler, useTourTarget } from '../../src/components/tour';
import { HomeSkeleton } from '../../src/components/Skeleton';
import { MoodIcon } from '../../src/components/MoodIcon';
import { useFeedback } from '../../src/components/feedback';
import { IMAGES, EDITOR_ICONS } from '../../src/data/assets';
import { AssetIcon } from '../../src/components/AssetIcon';
import { DAILY_QUOTES, MOODS } from '../../src/data/constants';
import { isDictationSupported } from '../../src/utils/dictation';
import { groupEntriesByDate } from '../../src/utils/grouping';
import type { Entry, MoodKey } from '../../src/store/types';

type SubTab = 'all' | 'draft' | 'favorite' | 'pinned';
type FlatListRow =
  | { type: 'header'; key: string; title: string; count: number }
  | { type: 'entry'; key: string; entry: Entry; index: number; first: boolean; last: boolean };

const USE_NATIVE = ND;

/** 9-11. 首页（列表分组虚拟化 / 左滑撤销 / 日记本切换 / 写作目标 / 快捷入口） */
export default function HomeScreen() {
  const { c, t, fs, dark, look, r, frame, ink } = useTheme();
  const { toast, sheet } = useFeedback();
  const reducedMotion = useReducedMotion();
  const hydrated = useHydrated();
  const entries = useStore(s => s.entries);
  const tags = useStore(s => s.tags);
  const notebooks = useStore(s => s.notebooks);
  const activeNotebook = useStore(s => s.activeNotebook);
  const account = useStore(s => s.account);
  const homeView = useStore(s => s.appearance.homeView);
  const onboarded = useStore(s => s.onboarded);
  const tutorialSeen = useStore(s => s.tutorialSeen);

  // 首次进入首页：等启动页淡出后再开始导览
  useEffect(() => {
    if (onboarded && tutorialSeen === false) {
      const tmr = setTimeout(() => openTutorial('home'), 700);
      return () => clearTimeout(tmr);
    }
  }, [onboarded, tutorialSeen]);

  const [tab, setTab] = useState<SubTab>('all');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterMood, setFilterMood] = useState<MoodKey | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [fabMounted, setFabMounted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // 听写只在真正支持的环境里给入口（Expo Go / 不支持的原生构建不显示）
  const dictationSupported = useMemo(() => isDictationSupported(), []);

  const navigation = useNavigation();
  const listRef = useRef<FlatList<any>>(null);
  const titleTarget = useTourTarget('home.title');
  const toolsTarget = useTourTarget('home.tools');
  const fabTarget = useTourTarget('home.fab');

  const scrollToTop = useCallback((animated = true) => {
    listRef.current?.scrollToOffset({ offset: 0, animated });
  }, []);

  // 再点一次「日记」标签：回到列表顶部
  useEffect(() => {
    const unsub = (navigation as any).addListener?.('tabPress', () => {
      if (navigation.isFocused()) scrollToTop(true);
    });
    return unsub;
  }, [navigation, scrollToTop]);

  // 导览开始前：收起菜单、回到顶部，保证聚光灯对准的控件都在屏幕里
  useEffect(() => {
    setTourHandler('home.prepare', () => {
      setFabOpen(false);
      setDropOpen(false);
      closeOpenSwipeRow();
      scrollToTop(false);
    });
    return () => setTourHandler('home.prepare', null);
  }, [scrollToTop]);

  // 快捷新建菜单：弹簧展开，收起时先播完动画再卸载
  const fabAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fabAnim.stopAnimation();
    if (reducedMotion) {
      fabAnim.setValue(fabOpen ? 1 : 0);
      setFabMounted(fabOpen);
      return;
    }
    if (fabOpen) {
      setFabMounted(true);
      Animated.spring(fabAnim, { toValue: 1, useNativeDriver: USE_NATIVE, ...SPRING.pop }).start();
    } else {
      Animated.timing(fabAnim, { toValue: 0, duration: 160, useNativeDriver: USE_NATIVE }).start(({ finished }) => {
        if (finished) setFabMounted(false);
      });
    }
    return () => fabAnim.stopAnimation();
  }, [fabOpen, fabAnim, reducedMotion]);

  const currentNotebook = useMemo(
    () => (activeNotebook ? notebooks.find(n => n.id === activeNotebook) : undefined),
    [notebooks, activeNotebook],
  );

  const aliveEntries = useMemo(() => entries.filter(e => !e.deletedAt && !e.hidden), [entries]);
  const notebookEntries = useMemo(
    () => aliveEntries.filter(e => inNotebook(e, activeNotebook)),
    [aliveEntries, activeNotebook],
  );
  const draftCount = useMemo(
    () => notebookEntries.filter(e => e.status === 'draft').length,
    [notebookEntries],
  );

  const filtered = useMemo(() => {
    let list: Entry[] = notebookEntries;
    if (tab === 'draft') list = list.filter(e => e.status === 'draft');
    else if (tab === 'favorite') list = list.filter(e => e.favorite);
    else if (tab === 'pinned') list = list.filter(e => e.pinned);
    else list = list.filter(e => e.status === 'published');

    if (filterTag) list = list.filter(e => e.tags.includes(filterTag));
    if (filterMood) list = list.filter(e => e.mood === filterMood);

    return [...list].sort((a, b) => {
      if (tab !== 'draft' && a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt - a.createdAt;
    });
  }, [notebookEntries, tab, filterTag, filterMood]);

  const listRows = useMemo<FlatListRow[]>(() => {
    const groups = groupEntriesByDate(filtered, Date.now(), tab !== 'draft');
    const out: FlatListRow[] = [];
    let idx = 0;
    for (const g of groups) {
      out.push({ type: 'header', key: `hdr_${g.key}`, title: g.title, count: g.entries.length });
      g.entries.forEach((e, i) => {
        out.push({ type: 'entry', key: e.id, entry: e, index: idx++, first: i === 0, last: i === g.entries.length - 1 });
      });
    }
    return out;
  }, [filtered, tab]);

  const notebookCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const nb of notebooks) {
      counts.set(nb.id, aliveEntries.filter(e => inNotebook(e, nb.id)).length);
    }
    return counts;
  }, [notebooks, aliveEntries]);

  const toggleView = useCallback(() => {
    haptic('light');
    actions.setAppearance({ homeView: homeView === 'list' ? 'card' : 'list' });
  }, [homeView]);

  const openEntry = useCallback((e: Entry) => {
    if (e.status === 'draft') router.push({ pathname: '/write', params: { id: e.id } });
    else router.push({ pathname: '/memory/[id]', params: { id: e.id } });
  }, []);

  const [removingIds, setRemovingIds] = useState<ReadonlySet<string>>(new Set());
  const removingRef = useRef(new Set<string>());
  const markRemoving = useCallback((id: string) => {
    removingRef.current.add(id);
    setRemovingIds(new Set(removingRef.current));
  }, []);
  const unmarkRemoving = useCallback((id: string) => {
    removingRef.current.delete(id);
    setRemovingIds(new Set(removingRef.current));
  }, []);

  const doTrash = useCallback(
    (entry: Entry) => {
      unmarkRemoving(entry.id);
      animateNextLayout();
      actions.trashEntry(entry.id);
      toast('已移入最近删除', {
        type: 'info',
        action: {
          label: '撤销',
          onPress: () => {
            animateNextLayout();
            actions.restoreEntry(entry.id);
            toast('已恢复该日记');
          },
        },
      });
    },
    [toast, unmarkRemoving],
  );

  // 先揉成纸团（可见的行播放 CrumpleRow，离屏/减动效直接删），动画/兜底计时结束才真正移入回收站
  const trashWithUndo = useCallback(
    (entry: Entry) => {
      if (reducedMotion) {
        doTrash(entry);
        return;
      }
      markRemoving(entry.id);
      // 若行未挂载（离屏虚拟化），400ms 兜底保证删除一定发生
      setTimeout(() => {
        if (removingRef.current.has(entry.id)) doTrash(entry);
      }, 400);
    },
    [reducedMotion, doTrash, markRemoving],
  );

  const openNotebookPickerForEntry = useCallback(
    (entry: Entry) => {
      sheet(
        notebooks.map(nb => ({
          label: nb.name + (inNotebook(entry, nb.id) ? '（当前）' : ''),
          icon: FolderInput,
          onPress: () => {
            actions.moveToNotebook([entry.id], nb.id);
            toast(`已移动到「${nb.name}」`);
          },
        })),
        '移动到日记本',
      );
    },
    [notebooks, sheet, toast],
  );

  const openEntrySheet = useCallback(
    (entry: Entry) => {
      haptic('medium');
      sheet(
        [
          {
            label: entry.pinned ? '取消置顶' : '置顶日记',
            icon: Pin,
            onPress: () => {
              const next = actions.togglePinned(entry.id);
              toast(next ? '已置顶到首页' : '已取消置顶');
            },
          },
          {
            label: entry.favorite ? '取消收藏' : '添加到收藏',
            icon: Heart,
            onPress: () => {
              const next = actions.toggleFavorite(entry.id);
              toast(next ? '已添加到我的收藏' : '已取消收藏');
            },
          },
          {
            label: '移动到日记本',
            icon: FolderInput,
            onPress: () => openNotebookPickerForEntry(entry),
          },
          {
            label: '删除日记',
            icon: Trash2,
            destructive: true,
            onPress: () => trashWithUndo(entry),
          },
        ],
        entry.title || '操作日记',
      );
    },
    [openNotebookPickerForEntry, sheet, toast, trashWithUndo],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (account) {
        const res = await actions.syncNow();
        if (!res.ok) toast(res.message || '同步失败', { type: 'warning' });
        else if (res.conflicts > 0) toast(`发现 ${res.conflicts} 条同步冲突`, { type: 'warning', action: { label: '去处理', onPress: () => router.push('/sync-conflict') } });
        else toast('同步完成');
      } else {
        toast('本机内容已刷新', { message: '登录并开启云同步后，可以同步到其他设备。' });
      }
    } catch {
      toast('暂时无法同步，请检查网络后重试', { type: 'warning' });
    } finally {
      setRefreshing(false);
    }
  }, [account, toast]);

  const loadSamples = useCallback(() => {
    actions.importSamples();
    toast('已导入示例日记', { message: '你可以自由浏览、编辑或随时删除它们' });
  }, [toast]);

  const moodsUsed = useMemo(
    () => new Set(notebookEntries.filter(e => e.status === 'published' && e.mood).map(e => e.mood!)),
    [notebookEntries],
  );

  const activeFilterLabel = useMemo(() => {
    const parts: string[] = [];
    if (filterTag) parts.push(`#${tags.find(x => x.id === filterTag)?.name ?? filterTag}`);
    if (filterMood) parts.push(MOODS.find(x => x.key === filterMood)?.label ?? filterMood);
    return parts.join(' · ');
  }, [filterTag, filterMood, tags]);

  const showToday = tab === 'all' && !filterTag && !filterMood;

  // 心情快捷筛选行：问候卡之下、「最近记录」之上；有筛选时问候卡隐藏它仍留在顶部
  const moodChips = useMemo(() => {
    if (tab !== 'all' || moodsUsed.size < 2) return null;
    return (
      <View style={{ flexShrink: 0, marginBottom: 12 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0, marginHorizontal: -20 }}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
        >
          {MOODS.filter(m => moodsUsed.has(m.key)).map(m => (
            <Chip
              key={m.key}
              size="sm"
              label={m.label}
              icon={<MoodIcon mood={m.key} size={14} />}
              selected={filterMood === m.key}
              onPress={() => {
                haptic('light');
                setFilterMood(cur => (cur === m.key ? null : m.key));
              }}
            />
          ))}
        </ScrollView>
      </View>
    );
  }, [tab, moodsUsed, filterMood]);

  const listHeader = useMemo(() => {
    return (
      <View>
        {showToday && <TodayCard />}
        {showToday && <OnThisDay />}
        {moodChips}

        {homeView === 'card' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: fs(13), color: c.textSub, fontWeight: '500' }}>
              {tab === 'draft' ? '未完成草稿' : tab === 'favorite' ? '收藏瞬间' : tab === 'pinned' ? '置顶记录' : '最近记录'}
            </Text>
            <Text style={{ fontSize: fs(12), color: c.textMuted }}>共 {filtered.length} 篇</Text>
          </View>
        )}
      </View>
    );
  }, [showToday, tab, c, fs, homeView, filtered.length, moodChips]);

  // 列表底部「每日一句」（Diarly 首页名言卡）：衬线居中排版，按日轮换
  const listFooter = useMemo(() => {
    const quote = DAILY_QUOTES[new Date().getDate() % DAILY_QUOTES.length];
    return (
      <FadeIn dy={8} style={{ marginTop: 6, marginBottom: 4, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 22 }}>
        <View style={{ width: 28, height: 1, backgroundColor: c.divider, marginBottom: 14 }} />
        <Text style={{ fontSize: fs(10.5), color: c.textMuted, letterSpacing: 3 }}>每 日 一 句</Text>
        <Text textRole="reading" style={{ fontSize: fs(15), color: c.textSub, lineHeight: fs(15) * 1.8, textAlign: 'center', marginTop: 10, fontStyle: 'italic' }}>
          “{quote.text}”
        </Text>
        <Text style={{ fontSize: fs(11), color: c.textMuted, marginTop: 8 }}>—— {quote.from}</Text>
      </FadeIn>
    );
  }, [c.divider, c.textMuted, c.textSub, fs]);

  const makeSwipeActions = useCallback(
    (entry: Entry): SwipeAction[] => [
      {
        key: 'pin',
        label: entry.pinned ? '取消置顶' : '置顶',
        icon: Pin,
        color: c.primaryDark,
        onPress: () => {
          const next = actions.togglePinned(entry.id);
          toast(next ? '已置顶到首页' : '已取消置顶');
        },
      },
      {
        key: 'fav',
        label: entry.favorite ? '取消收藏' : '收藏',
        icon: Heart,
        color: c.warning,
        onPress: () => {
          const next = actions.toggleFavorite(entry.id);
          toast(next ? '已添加到我的收藏' : '已取消收藏');
        },
      },
      {
        key: 'del',
        label: '删除',
        icon: Trash2,
        color: c.danger,
        onPress: () => trashWithUndo(entry),
      },
    ],
    [c.primaryDark, c.warning, c.danger, toast, trashWithUndo],
  );

  const renderListRow = useCallback(
    ({ item }: { item: FlatListRow }) => {
      if (item.type === 'header') {
        // 设计稿1 #9：分组标题用衬线小标题，与卡片拉开层级
        return (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 16, marginBottom: 10, paddingHorizontal: 2 }}>
            <Text style={[t.h2, { fontSize: fs(15.5) }]}>{item.title}</Text>
            <Text style={{ fontSize: fs(11.5), color: c.textMuted }}>{item.count} 篇</Text>
          </View>
        );
      }
      // 同一组日记共用一张卡片：只在组首组尾画圆角，外层统一投一层阴影
      return (
        <View
          style={{
            marginBottom: item.last ? 18 : 0,
            backgroundColor: c.card,
            borderTopLeftRadius: item.first ? r(18) : 0,
            borderTopRightRadius: item.first ? r(18) : 0,
            borderBottomLeftRadius: item.last ? r(18) : 0,
            borderBottomRightRadius: item.last ? r(18) : 0,
            borderLeftWidth: look.flat ? 1 : dark ? 0 : StyleSheet.hairlineWidth,
            borderRightWidth: look.flat ? 1 : dark ? 0 : StyleSheet.hairlineWidth,
            borderTopWidth: look.flat ? (item.first ? 1 : 0) : dark || !item.first ? 0 : StyleSheet.hairlineWidth,
            borderBottomWidth: look.flat ? (item.last ? 1 : 0) : dark || !item.last ? 0 : StyleSheet.hairlineWidth,
            borderColor: look.flat ? c.border : c.divider,
            ...(item.last && !dark && !look.flat
              ? { shadowColor: c.shadow, shadowOpacity: 0.045, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 1 }
              : {}),
          }}
        >
          <SwipeRow actions={makeSwipeActions(item.entry)} radius={item.first && item.last ? r(18) : 0}>
            <CrumpleRow active={removingIds.has(item.entry.id)} onDone={() => doTrash(item.entry)}>
              <EntryListCard
                entry={item.entry}
                grouped={{ first: item.first, last: item.last }}
                onPress={() => openEntry(item.entry)}
                onLongPress={() => openEntrySheet(item.entry)}
              />
            </CrumpleRow>
          </SwipeRow>
        </View>
      );
    },
    [c.card, c.border, c.divider, c.shadow, c.textMuted, dark, fs, look.flat, r, t.h2, makeSwipeActions, openEntry, openEntrySheet, removingIds, doTrash],
  );

  const renderGridItem = useCallback(
    ({ item }: { item: Entry }) => (
      <View style={{ width: '48.2%', flexDirection: 'row' }}>
        <View style={{ flex: 1, minWidth: 0, flexDirection: 'row' }}>
          <CrumpleRow active={removingIds.has(item.id)} onDone={() => doTrash(item)} style={{ flex: 1 }}>
            <EntryGridCard
              entry={item}
              onPress={() => openEntry(item)}
              onLongPress={() => openEntrySheet(item)}
            />
          </CrumpleRow>
        </View>
      </View>
    ),
    [openEntry, openEntrySheet, removingIds, doTrash],
  );

  return (
    <Screen edges={['top']}>
      {/* 顶部栏 */}
      <View style={{ height: 52, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          ref={titleTarget}
          collapsable={false}
          onPress={() => {
            haptic('light');
            setDropOpen(true);
          }}
          hitSlop={10}
          accessibilityLabel="日记本与筛选"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 }}
        >
          {currentNotebook && (
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: currentNotebook.color }} />
          )}
          <Text style={[t.h1, { fontSize: fs(24), flexShrink: 1 }]} numberOfLines={1}>
            {currentNotebook ? currentNotebook.name : '记得日记'}
          </Text>
          <ChevronDown size={18} color={c.textSub} />
        </Pressable>

        <View ref={toolsTarget} collapsable={false} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <IconButton icon={Search} label="搜索" onPress={() => router.push('/search')} />
          <IconButton
            icon={homeView === 'list' ? LayoutGrid : List}
            label="切换视图"
            onPress={toggleView}
          />
        </View>
      </View>

      {/* 二级分类栏（全部 / 日记 / 草稿 / 收藏 / 置顶） */}
      <View style={{ paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.divider }}>
        <UnderlineTabs
          value={tab}
          onChange={setTab}
          items={[
            { key: 'all', label: '全部' },
            { key: 'draft', label: '草稿', count: draftCount || undefined },
            { key: 'favorite', label: '收藏' },
            { key: 'pinned', label: '置顶' },
          ]}
        />
      </View>

      {!!activeFilterLabel && (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, gap: 8 }}>
          <Text style={{ fontSize: fs(12), color: c.textSub }}>筛选条件：</Text>
          <Chip
            size="sm"
            selected
            label={activeFilterLabel}
            onRemove={() => {
              setFilterTag(null);
              setFilterMood(null);
            }}
          />
        </View>
      )}

      {/* 主内容 */}
      {!hydrated ? (
        <HomeSkeleton />
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, paddingTop: 14, paddingHorizontal: 20, paddingBottom: 40 }}>
          {moodChips}
          <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            illustration="emptyBook"
            imageSize={185}
            title={tab === 'all' ? '还没有任何日记' : '这里暂时空空的'}
            desc={
              tab === 'draft'
                ? '写到一半不想丢失的想法，会自动存放在草稿箱里。'
                : tab === 'favorite'
                  ? '遇到特别珍贵的句子，可以在详情页点击收藏。'
                  : tab === 'pinned'
                    ? '把重要的日记置顶，它会一直留在这里等你。'
                    : '写下第一篇日记，开始记录属于你的生活吧。'
            }
            action="写一篇日记"
            onAction={() => router.push('/write')}
            secondary={
              activeNotebook
                ? '查看全部日记本'
                : entries.length === 0
                  ? '加载示例日记体验'
                  : undefined
            }
            onSecondary={
              activeNotebook
                ? () => actions.setActiveNotebook(null)
                : entries.length === 0
                  ? loadSamples
                  : undefined
            }
          />
          </View>
        </View>
      ) : homeView === 'list' ? (
        <FlatList
          ref={listRef}
          key="list"
          onScrollBeginDrag={closeOpenSwipeRow}
          data={listRows}
          keyExtractor={item => item.key}
          renderItem={renderListRow}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 112 }}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={5}
          updateCellsBatchingPeriod={40}
          removeClippedSubviews={Platform.OS !== 'web'}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={c.primary} colors={[c.primary]} />}
        />
      ) : (
        <FlatList
          ref={listRef}
          key="grid"
          data={filtered}
          numColumns={2}
          keyExtractor={item => item.id}
          renderItem={renderGridItem}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 12 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 112 }}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={5}
          updateCellsBatchingPeriod={40}
          removeClippedSubviews={Platform.OS !== 'web'}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={c.primary} colors={[c.primary]} />}
        />
      )}

      {/* 悬浮写作按钮 & 5 项快捷新建菜单 */}
      {fabMounted && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { zIndex: 20, backgroundColor: dark ? 'rgba(0,0,0,0.45)' : 'rgba(24,24,22,0.18)', opacity: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }) },
          ]}
        >
          <Pressable style={{ flex: 1 }} onPress={() => setFabOpen(false)} accessibilityLabel="收起新建菜单" />
          <Animated.View
            style={{
              position: 'absolute',
              right: 20,
              bottom: 86,
              width: 168,
              backgroundColor: c.card,
              borderRadius: r(16),
              paddingVertical: 6,
              borderWidth: look.flat ? 1 : StyleSheet.hairlineWidth,
              borderColor: look.flat ? c.border : c.divider,
              shadowColor: c.shadow,
              shadowOpacity: dark || look.flat ? 0 : 0.14,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 6 },
              elevation: dark || look.flat ? 0 : 8,
              transformOrigin: 'right bottom',
              transform: [
                { scale: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) },
                { translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
              ],
            }}
          >
            {[
              { label: '写日记', asset: EDITOR_ICONS.write, onPress: () => router.push('/write') },
              { label: '用模板', asset: EDITOR_ICONS.sticker, onPress: () => router.push('/templates') },
              { label: '录音记录', asset: EDITOR_ICONS.audio, onPress: () => router.push({ pathname: '/write', params: { action: 'audio' } }) },
              { label: '拍照记录', asset: EDITOR_ICONS.photo, onPress: () => router.push({ pathname: '/write', params: { action: 'photo' } }) },
              { label: '拍视频', asset: EDITOR_ICONS.video, onPress: () => router.push({ pathname: '/write', params: { action: 'video' } }) },
              ...(dictationSupported
                ? [{ label: '语音听写', icon: AudioLines, onPress: () => router.push({ pathname: '/write', params: { action: 'dictate' } }) }]
                : []),
            ].map((item, idx) => (
              <Pressable
                key={item.label}
                onPress={() => {
                  haptic('light');
                  setFabOpen(false);
                  item.onPress();
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 11,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0,
                  borderTopColor: c.divider,
                  backgroundColor: pressed ? c.cardAlt : 'transparent',
                })}
              >
                <View style={{ width: 32, height: 32, borderRadius: r(10), backgroundColor: c.primaryFaint, alignItems: 'center', justifyContent: 'center' }}>
                  {'asset' in item && item.asset ? (
                    <AssetIcon source={item.asset} size={17} color={c.primaryDark} />
                  ) : (
                    item.icon && <item.icon size={16} color={c.primaryDark} strokeWidth={1.85} />
                  )}
                </View>
                <Text style={{ fontSize: fs(14), color: c.text }}>{item.label}</Text>
              </Pressable>
            ))}
          </Animated.View>
        </Animated.View>
      )}

      <View ref={fabTarget} collapsable={false} style={{ position: 'absolute', right: 20, bottom: 20, zIndex: 25 }}>
        {ink.on ? (
          <InkPress
            offset={3}
            radius={29}
            underlay={dark ? '#000000' : ink.line}
            onPress={() => {
              haptic('medium');
              setFabOpen(v => !v);
            }}
            accessibilityLabel={fabOpen ? '收起新建菜单' : '新建日记'}
            faceStyle={{
              width: 58,
              height: 58,
              borderRadius: 29,
              backgroundColor: c.primary,
              borderWidth: 1.5,
              borderColor: ink.line,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {fabOpen ? (
              <X size={26} color="#182326" strokeWidth={2.3} />
            ) : (
              <AssetIcon source={EDITOR_ICONS.write} size={26} color="#182326" />
            )}
          </InkPress>
        ) : (
          <PressableScale
            scaleTo={0.9}
            onPress={() => {
              haptic('medium');
              setFabOpen(v => !v);
            }}
            accessibilityLabel={fabOpen ? '收起新建菜单' : '新建日记'}
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: c.primary,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: c.primaryDark,
              shadowOpacity: dark || look.flat ? 0 : 0.28,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 5 },
              elevation: dark || look.flat ? 0 : 5,
            }}
          >
            <Animated.View style={{ transform: [{ rotate: fabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }}>
              <Plus size={26} color={c.textOnPrimary} strokeWidth={2.3} />
            </Animated.View>
          </PressableScale>
        )}
      </View>

      {/* 顶部标题下拉面板：日记本切换 + 内容空间 + 筛选 */}
      <BottomSheet visible={dropOpen} onClose={() => setDropOpen(false)} title="日记本与筛选" maxHeight={0.82}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 6, paddingBottom: 8 }}>
          {/* 日记本切换区 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: fs(12.5), color: c.textSub }}>我的日记本</Text>
            <Pressable
              hitSlop={8}
              onPress={() => {
                setDropOpen(false);
                router.push('/notebooks');
              }}
            >
              <Text style={{ fontSize: fs(12.5), color: c.primaryDark, fontWeight: '500' }}>管理 ›</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
            <Pressable
              onPress={() => {
                haptic('light');
                actions.setActiveNotebook(null);
                setDropOpen(false);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: activeNotebook === null ? c.primaryFaint : c.card,
                borderWidth: 1,
                borderColor: activeNotebook === null ? c.primary : c.divider,
              }}
            >
              <BookOpen size={14} color={activeNotebook === null ? c.primaryDark : c.textSub} />
              <Text style={{ fontSize: fs(13), color: activeNotebook === null ? c.primaryDark : c.text, fontWeight: activeNotebook === null ? '600' : '400' }}>
                全部 ({aliveEntries.length})
              </Text>
            </Pressable>
            {notebooks.map(nb => {
              const active = activeNotebook === nb.id;
              return (
                <Pressable
                  key={nb.id}
                  onPress={() => {
                    haptic('light');
                    actions.setActiveNotebook(nb.id);
                    setDropOpen(false);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 12,
                    backgroundColor: active ? c.primaryFaint : c.card,
                    borderWidth: 1,
                    borderColor: active ? c.primary : c.divider,
                  }}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: nb.color }} />
                  <Text style={{ fontSize: fs(13), color: active ? c.primaryDark : c.text, fontWeight: active ? '600' : '400' }}>
                    {nb.name} ({notebookCounts.get(nb.id) ?? 0})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={{ fontSize: fs(12.5), color: c.textSub, marginBottom: 8 }}>内容空间</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
            {[
              { label: '草稿箱', icon: FileText, path: '/drafts' as const },
              { label: '我的收藏', icon: Heart, path: '/favorites' as const },
              { label: '影像记忆', icon: ImageIcon, path: '/photos' as const },
              { label: '最近删除', icon: Trash2, path: '/trash' as const },
              { label: '隐藏日记', icon: Lock, path: '/hidden' as const },
              { label: '离线状态', icon: CloudOff, path: '/offline' as const },
            ].map(item => (
              <PressableScale
                key={item.label}
                onPress={() => {
                  setDropOpen(false);
                  router.push(item.path);
                }}
                style={{ width: '31%', backgroundColor: c.card, borderRadius: r(14), paddingVertical: 12, alignItems: 'center', gap: 7, ...frame }}
              >
                <View style={{ width: 34, height: 34, borderRadius: r(10), backgroundColor: c.primaryFaint, alignItems: 'center', justifyContent: 'center' }}>
                  <item.icon size={17} color={c.primaryDark} strokeWidth={1.75} />
                </View>
                <Text style={{ fontSize: fs(12), color: c.text }}>{item.label}</Text>
              </PressableScale>
            ))}
          </View>

          <Text style={{ fontSize: fs(12.5), color: c.textSub, marginBottom: 8 }}>按心情筛选</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {MOODS.map(m => (
              <Chip
                key={m.key}
                label={m.label}
                icon={<MoodIcon mood={m.key} size={15} />}
                selected={filterMood === m.key}
                onPress={() => {
                  setFilterMood(cur => (cur === m.key ? null : m.key));
                  setDropOpen(false);
                }}
              />
            ))}
          </View>

          <Text style={{ fontSize: fs(12.5), color: c.textSub, marginBottom: 8 }}>按标签筛选</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {tags.map(tg => (
              <Chip
                key={tg.id}
                label={`#${tg.name}`}
                selected={filterTag === tg.id}
                onPress={() => {
                  setFilterTag(cur => (cur === tg.id ? null : tg.id));
                  setDropOpen(false);
                }}
              />
            ))}
          </View>
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}
