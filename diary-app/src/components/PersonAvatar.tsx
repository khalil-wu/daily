import React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Person } from '../store/types';
import { useTheme } from '../theme/ThemeProvider';

/** 身边人的圆形标识：底色取自个人配色，中间是名字的第一个字 */
export function PersonAvatar({ person, size = 40, style }: { person: Pick<Person, 'name' | 'color'>; size?: number; style?: StyleProp<ViewStyle> }) {
  const { fs } = useTheme();
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: person.color,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text style={{ fontSize: fs(size * 0.42), color: '#fff', fontWeight: '600' }}>{person.name.slice(0, 1)}</Text>
    </View>
  );
}
