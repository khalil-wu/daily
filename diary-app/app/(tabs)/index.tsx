import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../src/components/text';
import { router, useNavigation } from 'expo-router';
import {
  ChevronDown, ChevronLeft, CloudOff, FileText, FolderInput, Heart,
  Image as ImageIcon, LayoutGrid, List, Lock, Pin, Search, Trash2,
} from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions, inNotebook, openTutorial, useHydrated, useStore } from '../../src/store/store';
import { Chip, EmptyState, IconButton, Screen, UnderlineTabs, haptic } from '../../src/components/ui';
import { EntryGridCard, EntryListCard } from '../../src/components/EntryCard';
import { SwipeRow, closeOpenSwipeRow, type SwipeAction } from '../../src/components/SwipeRow';
import { leaveBook, useOpenSearch } from '../../src/components/BookScope';
import { OnThisDay } from '../../src/components/OnThisDay';
import { animateNextLayout, BottomSheet, CrumpleRow, FadeIn, PressableScale, useReducedMotion } from '../../src/components/motion';
import { setTourHandler, useTourTarget } from '../../src/components/tour';
import { HomeSkeleton } from '../../src/components/Skeleton';
import { MoodIcon } from '../../src/components/MoodIcon';
import { useFeedback } from '../../src/components/feedback';
import { DAILY_QUOTES, MOODS } from '../../src/data/constants';
import { groupEntriesByDate } from '../../src/utils/grouping';
import type { Entry, MoodKey } from '../../src/store/types';

type SubTab = 'all' | 'draft' | 'favorite' | 'pinned';
type FlatListRow =
  | { type: 'header'; key: string; title: string; count: number }
  | { type: 'entry'; key: string; entry: Entry; index: number; first: boolean; last: boolean };


/** 9-11. 首页（列表分组虚拟化 / 左滑撤销 / 日记本切换 / 写作目标 / 快捷入口） */
export default function HomeScreen() {
  const { c, t, fs, r, frame } = useTheme();
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
  const [refreshing, setRefreshing] = useState(false);

  const openSearch = useOpenSearch();
  const navigation = useNavigation();
  const listRef = useRef<FlatList<any>>(null);
  const titleTarget = useTourTarget('home.title');
  const toolsTarget = useTourTarget('home.tools');

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
      setDropOpen(false);
      closeOpenSwipeRow();
      scrollToTop(false);
    });
    return () => setTourHandler('home.prepare', null);
  }, [scrollToTop]);


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

  const activeFilterLabel = useMemo(() => {
    const parts: string[] = [];
    if (filterTag) parts.push(`#${tags.find(x => x.id === filterTag)?.name ?? filterTag}`);
    if (filterMood) parts.push(MOODS.find(x => x.key === filterMood)?.label ?? filterMood);
    return parts.join(' · ');
  }, [filterTag, filterMood, tags]);

  const showToday = tab === 'all' && !filterTag && !filterMood;

  const listHeader = useMemo(() => {
    return (
      <View>
        {showToday && <OnThisDay />}

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
  }, [showToday, tab, c, fs, homeView, filtered.length]);

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
        return (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 14, marginBottom: 8, paddingHorizontal: 4 }}>
            <Text accessibilityRole="header" style={{ fontSize: fs(13), color: c.textSub, fontWeight: '600' }}>{item.title}</Text>
            <Text style={{ fontSize: fs(12), color: c.textMuted }}>{item.count} 篇</Text>
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
            borderLeftWidth: StyleSheet.hairlineWidth,
            borderRightWidth: StyleSheet.hairlineWidth,
            borderTopWidth: item.first ? StyleSheet.hairlineWidth : 0,
            borderBottomWidth: item.last ? StyleSheet.hairlineWidth : 0,
            borderColor: c.divider,
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
    [c.card, c.divider, c.textSub, c.textMuted, fs, r, makeSwipeActions, openEntry, openEntrySheet, removingIds, doTrash],
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
          accessibilityRole="button"
          accessibilityLabel="回到书架"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          onPress={() => {
            haptic('light');
            leaveBook();
          }}
          style={{ height: 44, marginLeft: -8, paddingRight: 6, flexDirection: 'row', alignItems: 'center' }}
        >
          <ChevronLeft size={24} color={c.text} strokeWidth={1.8} />
          <Text style={{ fontSize: fs(15), color: c.text }}>书架</Text>
        </Pressable>

        <Pressable
          ref={titleTarget}
          collapsable={false}
          onPress={() => {
            haptic('light');
            setDropOpen(true);
          }}
          hitSlop={10}
          accessibilityLabel="筛选与内容空间"
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 0, paddingHorizontal: 6 }}
        >
          {currentNotebook && (
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: currentNotebook.color }} />
          )}
          <Text style={[t.h3, { fontSize: fs(16), flexShrink: 1 }]} numberOfLines={1}>
            {currentNotebook ? currentNotebook.name : '全部日记'}
          </Text>
          <ChevronDown size={15} color={c.textMuted} />
        </Pressable>

        <View ref={toolsTarget} collapsable={false} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <IconButton icon={Search} label="搜索" onPress={openSearch} />
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
                ? '回到书架'
                : entries.length === 0
                  ? '加载示例日记体验'
                  : undefined
            }
            onSecondary={
              activeNotebook
                ? leaveBook
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
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 32 }}
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
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 32 }}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={5}
          updateCellsBatchingPeriod={40}
          removeClippedSubviews={Platform.OS !== 'web'}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={c.primary} colors={[c.primary]} />}
        />
      )}

      {/* 顶部标题下拉面板：日记本切换 + 内容空间 + 筛选 */}
      <BottomSheet visible={dropOpen} onClose={() => setDropOpen(false)} title="筛选与内容空间" maxHeight={0.82}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 6, paddingBottom: 8 }}>
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
