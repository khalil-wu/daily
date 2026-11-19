import React, { useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BookOpen, CloudOff, Compass, GitMerge, ShieldAlert } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions } from '../../src/store/store';
import { startHomeTour } from '../../src/components/TutorialOverlay';
import { APP_VERSION } from '../../src/data/constants';
import { IMAGES } from '../../src/data/assets';
import { Group, NavBar, Row, Screen } from '../../src/components/ui';
import { PermissionModal } from '../../src/components/PermissionModal';
import { useFeedback } from '../../src/components/feedback';

export default function AboutScreen() {
  const { c, t, fs } = useTheme();
  const { toast } = useFeedback();
  const [permOpen, setPermOpen] = useState(false);

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar variant="large" title="关于记得日记" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}>
        <View style={{ alignItems: 'center', paddingVertical: 22 }}>
          <Image
            source={IMAGES.appIcon}
            style={{ width: 82, height: 82, borderRadius: 20, marginBottom: 14 }}
          />
          <Text style={[t.h1, { fontSize: fs(21) }]}>记得日记</Text>
          <Text style={[t.sub, { marginTop: 4 }]}>记下生活，记得自己 · v{APP_VERSION}</Text>
        </View>

        <Group title="体验与权限">
          <Row
            icon={ShieldAlert}
            iconColor={c.primaryDark}
            title="权限说明与授权"
            subtitle="相册、麦克风、通知权限管理"
            onPress={() => setPermOpen(true)}
          />
          <Row
            icon={BookOpen}
            iconColor={c.primaryDark}
            title="新手导览"
            subtitle="跟着光圈重新认识首页的每个入口"
            onPress={startHomeTour}
          />
          <Row
            icon={Compass}
            iconColor={c.primaryDark}
            title="重新查看引导页"
            subtitle="重温产品初见介绍"
            onPress={() => router.push('/onboarding')}
          />
          <Row
            icon={BookOpen}
            iconColor={c.primaryDark}
            title="导入示例日记"
            subtitle="添加精选示例日记，方便体验回顾与统计"
            onPress={() => {
              actions.importSamples();
              toast('已导入示例日记');
            }}
          />
        </Group>

        <Group title="状态页查看">
          <Row
            icon={CloudOff}
            iconColor={c.primaryDark}
            title="离线状态提示"
            onPress={() => router.push('/offline')}
          />
          <Row
            icon={GitMerge}
            iconColor={c.primaryDark}
            title="同步冲突处理"
            onPress={() => router.push('/sync-conflict')}
          />
        </Group>

        <Text style={{ textAlign: 'center', fontSize: fs(12), color: c.textMuted, marginTop: 12 }}>
          一款专注记录、回顾与自我理解的日记应用
        </Text>
      </ScrollView>

      <PermissionModal visible={permOpen} onClose={() => setPermOpen(false)} />
    </Screen>
  );
}
