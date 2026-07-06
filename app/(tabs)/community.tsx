import { router } from 'expo-router';
import { Bell, BookOpen, Heart, Image as ImageIcon, Plus, Search, Send, X } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { motion, selectionFeedback, useReducedMotion } from '@/src/motion';
import { useVisibleDiaryData } from '@/src/privacy/useVisibleDiaryData';
import { useDiaryStore } from '@/src/stores/useDiaryStore';
import { colors, getContentWidth, radius, shadows, spacing, strokeWidth, typography } from '@/src/theme';

const topics = ['推荐', '收藏', '附近', '热门'];

export default function CommunityTabScreen() {
  const { visibleMemories } = useVisibleDiaryData();
  const communityPosts = useDiaryStore((state) => state.communityPosts);
  const publishMemoryToCommunity = useDiaryStore((state) => state.publishMemoryToCommunity);
  const toggleCommunityFollow = useDiaryStore((state) => state.toggleCommunityFollow);
  const toggleCommunityLike = useDiaryStore((state) => state.toggleCommunityLike);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeTopic, setActiveTopic] = useState('推荐');
  const [noticeOpen, setNoticeOpen] = useState(false);
  const { width } = useWindowDimensions();
  const contentWidth = useMemo(() => getContentWidth(width, { maxWidth: 720 }), [width]);
  const reducedMotion = useReducedMotion();
  const offset = useRef(new Animated.Value(10)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const shareableMemories = visibleMemories.filter((memory) => !memory.isPrivate && !memory.isMasked);
  const sharedIds = new Set(communityPosts.map((post) => post.memoryId));
  const displayedPosts = useMemo(() => {
    if (activeTopic === '收藏') return communityPosts.filter((post) => post.followedByMe);
    if (activeTopic === '附近') {
      const nearbyMemoryIds = new Set(visibleMemories.filter((memory) => memory.location).map((memory) => memory.id));
      return communityPosts.filter((post) => nearbyMemoryIds.has(post.memoryId));
    }
    if (activeTopic === '热门') {
      return [...communityPosts].sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments));
    }
    return communityPosts;
  }, [activeTopic, communityPosts, visibleMemories]);

  const emptyCopy = useMemo(() => {
    if (communityPosts.length === 0) {
      return { title: '灵感墙还没有内容', text: '点右上角的加号，把一条日记贴到这里。' };
    }
    if (activeTopic === '收藏') return { title: '还没有收藏的内容', text: '收藏你感兴趣的日记后，它们会出现在这里。' };
    if (activeTopic === '附近') return { title: '附近还没有日记', text: '带位置的日记会优先出现在这里。' };
    if (activeTopic === '热门') return { title: '还没有热门内容', text: '有更多喜欢和评论后，热门会自动排序。' };
    return { title: '暂时没有内容', text: '换个分类看看，或者分享一条日记。' };
  }, [activeTopic, communityPosts.length]);

  const openPicker = () => {
    void selectionFeedback();
    setPickerOpen(true);
    offset.setValue(reducedMotion ? 0 : 10);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(offset, { toValue: 0, duration: motion.duration.base, useNativeDriver: motion.useNativeDriver }),
      Animated.timing(opacity, { toValue: 1, duration: motion.duration.base, useNativeDriver: motion.useNativeDriver }),
    ]).start();
  };

  const publish = (memoryId: string) => {
    void selectionFeedback();
    publishMemoryToCommunity(memoryId);
    setPickerOpen(false);
  };

  const toggleFollow = (postId: string) => {
    void selectionFeedback();
    toggleCommunityFollow(postId);
  };

  const toggleLike = (postId: string) => {
    void selectionFeedback();
    toggleCommunityLike(postId);
  };

  const openNotifications = () => {
    void selectionFeedback();
    setNoticeOpen(true);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { width: contentWidth }]} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>灵感墙</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="把一条日记贴到灵感墙" onPress={openPicker} style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
              <Plus size={18} color={colors.accent} strokeWidth={2.2} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="搜索灵感墙内容" onPress={() => router.push('/search')} style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
              <Search size={18} color={colors.textSecondary} strokeWidth={2.2} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="灵感墙通知" onPress={openNotifications} style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
              <Bell size={18} color={colors.textSecondary} strokeWidth={2.2} />
            </Pressable>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topicRow}>
          {topics.map((topic) => {
            const active = activeTopic === topic;
            return (
              <Pressable key={topic} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`查看${topic}`} onPress={() => { void selectionFeedback(); setActiveTopic(topic); }} style={[styles.topicChip, active && styles.topicChipActive]}>
                <Text style={[styles.topicText, active && styles.topicTextActive]}>{topic}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.feedList}>
          {displayedPosts.length > 0 ? displayedPosts.map((post) => (
            <Pressable key={post.id} accessibilityRole="button" accessibilityLabel={`查看灵感墙日记${post.title}`} onPress={() => router.push(`/memory/${post.memoryId}`)} style={({ pressed }) => [styles.postItem, pressed && styles.rowPressed]}>
              <View style={styles.postHeader}>
                <View style={styles.avatarMark}>
                  <Text style={styles.avatarText}>记</Text>
                </View>
                <View style={styles.postContent}>
                  <View style={styles.authorLine}>
                    <Text style={styles.authorName} numberOfLines={1}>我</Text>
                    <Text style={styles.postDate} numberOfLines={1}>· {post.date}{post.mood ? ` · ${post.mood}` : ''}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={post.followedByMe ? '取消收藏' : '收藏这条日记'}
                      onPress={(event) => {
                        event.stopPropagation();
                        toggleFollow(post.id);
                      }}
                      style={({ pressed }) => [styles.followButton, post.followedByMe && styles.followButtonActive, pressed && styles.followButtonPressed]}
                    >
                      <Text style={[styles.followText, post.followedByMe && styles.followTextActive]}>{post.followedByMe ? '已收藏' : '收藏'}</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.postTitle} numberOfLines={1}>{post.title}</Text>
                  <Text style={styles.postText} numberOfLines={5}>{post.content}</Text>
                  {post.attachmentUri ? <Image source={{ uri: post.attachmentUri }} style={styles.coverImage} /> : null}
                  <View style={styles.actionRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="阅读这条日记"
                      onPress={(event) => {
                        event.stopPropagation();
                        router.push(`/memory/${post.memoryId}`);
                      }}
                      style={({ pressed }) => [styles.actionItem, pressed && styles.actionItemPressed]}
                    >
                      <BookOpen size={16} color={colors.textTertiary} strokeWidth={2.2} />
                      <Text style={styles.actionText}>阅读</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={post.likedByMe ? '取消喜欢' : '喜欢这条动态'}
                      onPress={(event) => {
                        event.stopPropagation();
                        toggleLike(post.id);
                      }}
                      style={({ pressed }) => [styles.actionItem, pressed && styles.actionItemPressed]}
                    >
                      <Heart size={16} color={post.likedByMe ? colors.danger : colors.textTertiary} fill={post.likedByMe ? colors.danger : 'transparent'} strokeWidth={2.2} />
                      <Text style={[styles.actionText, post.likedByMe && styles.likeText]}>{post.likes || '喜欢'}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Pressable>
          )) : (
            <View style={styles.emptyCard}>
              <Send size={24} color={colors.accent} strokeWidth={1.8} />
              <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
              <Text style={styles.emptyText}>{emptyCopy.text}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <Animated.View style={[styles.sheet, { width: contentWidth, opacity, transform: [{ translateY: offset }] }]}>
            <Pressable onPress={(event) => event.stopPropagation()} style={styles.sheetInner}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>贴到灵感墙</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="关闭" onPress={() => setPickerOpen(false)} style={styles.sheetClose}>
                  <X size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
              <ScrollView style={styles.pickerList} contentContainerStyle={styles.pickerContent}>
                {shareableMemories.map((memory) => {
                  const shared = sharedIds.has(memory.id);
                  return (
                    <Pressable key={memory.id} accessibilityRole="button" accessibilityLabel={shared ? `${memory.title}已贴上` : `把${memory.title}贴到灵感墙`} disabled={shared} onPress={() => publish(memory.id)} style={({ pressed }) => [styles.memoryOption, shared && styles.memoryOptionDisabled, pressed && styles.memoryOptionPressed]}>
                      <View style={styles.memoryOptionText}>
                        <Text style={styles.memoryTitle} numberOfLines={1}>{memory.title}</Text>
                        <Text style={styles.memoryExcerpt} numberOfLines={2}>{memory.excerpt}</Text>
                      </View>
                      {memory.hasMedia ? <ImageIcon size={17} color={colors.textTertiary} /> : null}
                      <Text style={[styles.shareState, shared && styles.shareStateDone]}>{shared ? '已贴上' : '贴上'}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      <Modal visible={noticeOpen} transparent animationType="fade" onRequestClose={() => setNoticeOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setNoticeOpen(false)}>
          <Pressable onPress={(event) => event.stopPropagation()} style={[styles.noticeSheet, { width: contentWidth }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>灵感墙通知</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="关闭通知" onPress={() => setNoticeOpen(false)} style={styles.sheetClose}>
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.noticeText}>暂时没有新的互动。</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  content: { alignSelf: 'center', paddingTop: spacing.xl, paddingBottom: spacing.giant + 56, gap: spacing.md },
  headerRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg, paddingHorizontal: spacing.xl },
  headerCopy: { flex: 1, gap: spacing.xs },
  title: { color: colors.textPrimary, fontFamily: typography.fontFamily.display, fontSize: typography.titleLg, lineHeight: typography.lineHeights.titleLg, fontWeight: '700', includeFontPadding: false },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  iconButton: { width: 44, height: 44, borderRadius: radius.circle, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgSecondary, borderWidth: strokeWidth.button, borderColor: colors.stroke, ...shadows.card },
  iconButtonPressed: { backgroundColor: colors.bgWash },
  topicRow: { gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.xs },
  topicChip: { minHeight: 40, minWidth: 64, alignItems: 'center', justifyContent: 'center', borderRadius: radius.button, borderWidth: strokeWidth.input, borderColor: colors.stroke, backgroundColor: colors.bgSecondary, paddingHorizontal: spacing.lg, ...shadows.card },
  topicChipActive: { backgroundColor: colors.accent, borderColor: colors.stroke },
  topicText: { color: colors.textSecondary, fontFamily: typography.fontFamily.display, fontSize: typography.caption, lineHeight: typography.lineHeights.caption, fontWeight: '600', includeFontPadding: false },
  topicTextActive: { color: colors.bgPaper, fontWeight: '700' },
  composeRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.bgSecondary, borderRadius: radius.card, borderWidth: strokeWidth.card, borderColor: colors.stroke, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, marginHorizontal: spacing.xl, ...shadows.card },
  rowPressed: { backgroundColor: colors.bgWash },
  composeCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  composeTitle: { color: colors.textPrimary, fontFamily: typography.fontFamily.display, fontSize: typography.body, lineHeight: typography.lineHeights.body, fontWeight: '700', includeFontPadding: false },
  composeText: { color: colors.textTertiary, fontFamily: typography.fontFamily.display, fontSize: typography.caption, lineHeight: typography.lineHeights.caption, includeFontPadding: false },
  feedList: { gap: spacing.md, paddingHorizontal: spacing.xl },
  postItem: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.bgSecondary, borderRadius: radius.card, borderWidth: strokeWidth.card, borderColor: colors.stroke, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, ...shadows.card },
  postHeader: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  avatarMark: { width: 44, height: 44, borderRadius: radius.circle, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMint, borderWidth: strokeWidth.avatar, borderColor: colors.stroke },
  avatarText: { color: colors.accent, fontFamily: typography.fontFamily.display, fontSize: typography.body, lineHeight: typography.lineHeights.body, fontWeight: '700', includeFontPadding: false },
  postContent: { flex: 1, minWidth: 0, gap: spacing.xs },
  authorLine: { minHeight: 26, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  authorName: { color: colors.textPrimary, fontFamily: typography.fontFamily.display, fontSize: typography.body, lineHeight: typography.lineHeights.body, fontWeight: '700', includeFontPadding: false },
  postDate: { flex: 1, color: colors.textTertiary, fontFamily: typography.fontFamily.display, fontSize: typography.caption, lineHeight: typography.lineHeights.caption, includeFontPadding: false },
  followButton: { minHeight: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.button, backgroundColor: colors.accent, borderWidth: strokeWidth.input, borderColor: colors.stroke, paddingHorizontal: spacing.md },
  followButtonActive: { backgroundColor: colors.bgWash, borderWidth: strokeWidth.input, borderColor: colors.stroke },
  followButtonPressed: { opacity: 0.75 },
  followText: { color: colors.bgPaper, fontFamily: typography.fontFamily.display, fontSize: typography.micro, lineHeight: typography.lineHeights.micro, fontWeight: '700', includeFontPadding: false },
  followTextActive: { color: colors.textSecondary },
  postTitle: { color: colors.textPrimary, fontFamily: typography.fontFamily.display, fontSize: typography.body, lineHeight: typography.lineHeights.body, fontWeight: '700', includeFontPadding: false },
  postText: { color: colors.textPrimary, fontFamily: typography.fontFamily.reading, fontSize: typography.body, lineHeight: typography.lineHeights.body, includeFontPadding: false },
  coverImage: { width: '100%', height: 190, borderRadius: radius.input, backgroundColor: colors.bgWash, marginTop: spacing.sm, borderWidth: strokeWidth.input, borderColor: colors.stroke },
  actionRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, maxWidth: 360 },
  actionItem: { minHeight: 36, minWidth: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: spacing.xs },
  actionItemPressed: { opacity: 0.6 },
  actionText: { color: colors.textTertiary, fontFamily: typography.fontFamily.display, fontSize: typography.caption, lineHeight: typography.lineHeights.caption, fontWeight: '600', includeFontPadding: false },
  likeText: { color: colors.danger, fontWeight: '700' },
  emptyCard: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.card, borderWidth: strokeWidth.card, borderColor: colors.stroke, backgroundColor: colors.bgSecondary, padding: spacing.xl, marginHorizontal: spacing.xl, ...shadows.card },
  emptyTitle: { color: colors.textPrimary, fontFamily: typography.fontFamily.display, fontSize: typography.title, lineHeight: typography.lineHeights.title, fontWeight: '700', includeFontPadding: false },
  emptyText: { color: colors.textTertiary, fontFamily: typography.fontFamily.display, fontSize: typography.caption, lineHeight: typography.lineHeights.caption, textAlign: 'center', includeFontPadding: false },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: colors.scrim, padding: spacing.lg },
  sheet: { maxWidth: 720 },
  sheetInner: { maxHeight: 560, borderRadius: radius.card, borderWidth: strokeWidth.card, borderColor: colors.stroke, backgroundColor: colors.bgPaper, padding: spacing.lg, gap: spacing.md, ...shadows.sheet },
  noticeSheet: { maxWidth: 720, borderRadius: radius.card, borderWidth: strokeWidth.card, borderColor: colors.stroke, backgroundColor: colors.bgPaper, padding: spacing.lg, gap: spacing.md, ...shadows.sheet },
  sheetHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { color: colors.textPrimary, fontFamily: typography.fontFamily.display, fontSize: typography.title, lineHeight: typography.lineHeights.title, fontWeight: '700', includeFontPadding: false },
  sheetClose: { width: 44, height: 44, borderRadius: radius.circle, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgWash, borderWidth: strokeWidth.input, borderColor: colors.stroke },
  pickerList: { maxHeight: 440 },
  pickerContent: { gap: spacing.sm },
  memoryOption: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.button, borderWidth: strokeWidth.input, borderColor: colors.stroke, backgroundColor: colors.bgWash, padding: spacing.md },
  memoryOptionPressed: { backgroundColor: colors.surfaceMint },
  memoryOptionDisabled: { opacity: 0.58 },
  memoryOptionText: { flex: 1, minWidth: 0, gap: spacing.xs },
  memoryTitle: { color: colors.textPrimary, fontFamily: typography.fontFamily.display, fontSize: typography.body, lineHeight: typography.lineHeights.body, fontWeight: '700', includeFontPadding: false },
  memoryExcerpt: { color: colors.textTertiary, fontFamily: typography.fontFamily.reading, fontSize: typography.caption, lineHeight: typography.lineHeights.caption, includeFontPadding: false },
  shareState: { color: colors.accent, fontFamily: typography.fontFamily.display, fontSize: typography.caption, lineHeight: typography.lineHeights.caption, fontWeight: '700', includeFontPadding: false },
  shareStateDone: { color: colors.textTertiary },
  noticeText: { color: colors.textTertiary, fontFamily: typography.fontFamily.display, fontSize: typography.body, lineHeight: typography.lineHeights.body, includeFontPadding: false },
});
