import type { Entry, MoodKey, WeatherKey } from '../store/types';
import { uid } from '../utils/text';

interface Seed {
  daysAgo: number;
  hour: number;
  minute: number;
  title: string;
  body: string;
  mood?: MoodKey;
  tags: string[];
  photos?: string[];
  weather?: WeatherKey;
  temperature?: number;
  place?: string;
  favorite?: boolean;
  pinned?: boolean;
}

const SEEDS: Seed[] = [
  {
    daysAgo: 0, hour: 15, minute: 24, title: '在山间的一个下午',
    body: '今天去了城郊的山林，空气非常清新。沿着小路慢慢走，太阳透过树叶洒下斑驳的光影，整个人都放松了很多。\n\n原来，生活的美好常常藏在这样安静的时刻里。\n\n- 带了一本没读完的书\n- 在半山腰的亭子里坐了一个小时\n- 回来的路上看到了很美的晚霞',
    mood: 'happy', tags: ['travel', 'growth'], photos: ['asset:photo-mountain', 'asset:photo-daisy'], weather: 'sunny', temperature: 12, place: '杭州市 · 西湖区', favorite: true,
  },
  {
    daysAgo: 1, hour: 21, minute: 10, title: '阅读笔记：《被讨厌的勇气》',
    body: '“所谓的自由，就是被别人讨厌。”\n\n读到这里停了很久。很多时候我们太在意别人的评价，反而忘了自己真正想要什么。\n\n# 今天的收获\n1. 课题分离：分清什么是自己的课题\n2. 活在当下，人生是一连串的刹那',
    mood: 'calm', tags: ['reading', 'study'], photos: ['asset:photo-coffee'], weather: 'cloudy', temperature: 9, place: '杭州市 · 拱墅区', favorite: true,
  },
  {
    daysAgo: 2, hour: 10, minute: 30, title: '一个安静的周末',
    body: '今天在家读了很久的书，窗外阳光正好，泡了一壶茶，听着喜欢的音乐。心情也跟着平静下来。\n\n有时候什么都不做，也是一种很好的休息。',
    mood: 'calm', tags: ['life'], photos: ['asset:photo-field'], weather: 'sunny', temperature: 14, place: '杭州市 · 西湖区',
  },
  {
    daysAgo: 3, hour: 21, minute: 30, title: '微雨的傍晚',
    body: '晚饭后下了一点小雨，站在阳台听雨滴打在树叶上的声音。写了几行随想，内心慢慢安稳下来。',
    mood: 'calm', tags: ['life', 'emotion'], photos: ['asset:photo-mist'], weather: 'lightRain', temperature: 10, place: '杭州市 · 西湖区',
  },
  {
    daysAgo: 4, hour: 19, minute: 45, title: '工作之外的松弛',
    body: '下班路过公园，看到夕阳把整片天空染成橘色。停下来拍了几张照片，感觉一天的疲惫都被抚平了。\n\n要记得在忙碌里给自己留一点空白。',
    mood: 'tired', tags: ['work', 'emotion'], photos: ['asset:photo-sky'], weather: 'cloudy', temperature: 11, place: '杭州市 · 滨江区',
  },
  {
    daysAgo: 5, hour: 20, minute: 15, title: '读完一章好书',
    body: '晚上泡了一杯热牛奶，把书桌收拾干净，专心读完了两章。生活还是需要一点仪式感。',
    mood: 'happy', tags: ['reading'], photos: ['asset:photo-tea'], weather: 'cloudy', temperature: 10, place: '杭州市 · 西湖区',
  },
  {
    daysAgo: 6, hour: 22, minute: 5, title: '关于成长的一点思考',
    body: '好像越长大越明白，很多事情急不来。慢慢来，比较快。\n\n**接受自己的不完美**，也是成长的一部分。允许自己有低落的时候，也相信自己会慢慢好起来。',
    mood: 'grateful', tags: ['growth', 'emotion'], photos: ['asset:photo-blossom'], weather: 'overcast', temperature: 8, pinned: true,
  },
  {
    daysAgo: 7, hour: 19, minute: 10, title: '街角的梧桐树',
    body: '路过老街，午后的阳光斜斜洒下来，地面都是斑驳的树影。随手拍了一张。',
    mood: 'calm', tags: ['life'], photos: ['asset:photo-street'], weather: 'sunny', temperature: 13, place: '杭州市 · 上城区',
  },
  {
    daysAgo: 8, hour: 22, minute: 40, title: '整理桌面与心境',
    body: '把书桌上的杂物归类放好，突然觉得思路也跟着清晰了很多。',
    mood: 'happy', tags: ['growth'], photos: ['asset:photo-dried'], weather: 'cloudy', temperature: 12,
  },
  {
    daysAgo: 9, hour: 18, minute: 20, title: '和朋友的见面',
    body: '很久没见的朋友，聊了很多过去的事。时间过得真快，但有些感情一直都在。\n\n约好了春天一起去看海。',
    mood: 'happy', tags: ['life'], photos: ['asset:photo-flowers'], weather: 'sunny', temperature: 13, place: '杭州市 · 上城区',
  },
  {
    daysAgo: 10, hour: 21, minute: 5, title: '夜跑之后的清爽',
    body: '沿着河边跑了四公里，微风吹过特别舒服。出完汗感觉一整天的压力都散去了。',
    mood: 'calm', tags: ['sport', 'health'], photos: ['asset:photo-reeds'], weather: 'overcast', temperature: 9, place: '杭州市 · 运河边',
  },
  {
    daysAgo: 11, hour: 17, minute: 40, title: '给自己的小礼物',
    body: '买了一束白色小雏菊插在窗台花瓶里，心情瞬间亮起来。',
    mood: 'grateful', tags: ['life'], photos: ['asset:photo-daisy'], weather: 'sunny', temperature: 14,
  },
  {
    daysAgo: 12, hour: 9, minute: 30, title: '旅行记录 · 云南',
    body: '清晨的洱海边，雾气还没散去。远处的苍山若隐若现，像一幅水墨画。\n\n# 印象最深的瞬间\n骑车沿着环海路，风吹过耳边，觉得自由极了。',
    mood: 'happy', tags: ['travel'], photos: ['asset:photo-road', 'asset:photo-lake', 'asset:photo-mist'], weather: 'sunny', temperature: 16, place: '大理市 · 洱海', favorite: true,
  },
  {
    daysAgo: 15, hour: 23, minute: 40, title: '有点焦虑的夜晚',
    body: '项目临近交付，脑子里一直在转。写下来之后好了一些。\n\n- 先把最重要的一件事做完\n- 剩下的明天再说\n- 早点睡觉',
    mood: 'anxious', tags: ['work', 'emotion'], weather: 'lightRain', temperature: 7,
  },
  {
    daysAgo: 20, hour: 7, minute: 50, title: '晨跑五公里',
    body: '坚持晨跑的第十二天。今天跑得很轻松，河边的风有点冷，但很清醒。',
    mood: 'calm', tags: ['sport', 'health'], photos: ['asset:photo-reeds'], weather: 'overcast', temperature: 5, place: '杭州市 · 运河边',
  },
  {
    daysAgo: 27, hour: 20, minute: 15, title: '新年的小目标',
    body: '# 新的一年\n1. 每周至少写三篇日记\n2. 读完 24 本书\n3. 学会做饭\n4. 去一次没去过的城市\n\n慢慢来，一件一件完成。',
    mood: 'grateful', tags: ['growth'], photos: ['asset:photo-dried'], weather: 'sunny', temperature: 6,
  },
  {
    daysAgo: 45, hour: 16, minute: 0, title: '生活要有节奏',
    body: '开始尝试规律的作息，工作也变得更高效了。晚上留一小时给自己，读书或者写字。',
    mood: 'calm', tags: ['life', 'growth'], photos: ['asset:photo-tea'], weather: 'cloudy', temperature: 15,
  },
  {
    daysAgo: 80, hour: 17, minute: 30, title: '海边的日落',
    body: '第一次一个人去看海。日落的时候，天空从橙色变成粉色，再慢慢变成深蓝。那一刻觉得一切都很好。',
    mood: 'happy', tags: ['travel'], photos: ['asset:photo-sunset'], weather: 'sunny', temperature: 22, place: '舟山市 · 朱家尖', favorite: true,
  },
  {
    daysAgo: 365, hour: 21, minute: 0, title: '一年前的今天',
    body: '在忙碌中也要照顾好自己。愿未来的自己，回看今天时，会感谢此刻的坚持。',
    mood: 'grateful', tags: ['growth'], photos: ['asset:photo-street'], weather: 'overcast', temperature: 10,
  },
  {
    daysAgo: 400, hour: 14, minute: 20, title: '好像以前更能接纳自己了',
    body: '回头看去年写下的日记，发现自己已经走了很远。也更愿意接纳那些不完美的瞬间。',
    mood: 'calm', tags: ['growth', 'emotion'], weather: 'sunny', temperature: 18,
  },
];

/** 示例地点的示意坐标（让足迹地图开箱可见） */
const PLACE_COORDS: Record<string, { latitude: number; longitude: number }> = {
  '杭州市 · 西湖区': { latitude: 30.23, longitude: 120.13 },
  '杭州市 · 拱墅区': { latitude: 30.32, longitude: 120.14 },
  '杭州市 · 滨江区': { latitude: 30.21, longitude: 120.21 },
  '杭州市 · 上城区': { latitude: 30.24, longitude: 120.17 },
  '杭州市 · 运河边': { latitude: 30.3, longitude: 120.14 },
  '大理市 · 洱海': { latitude: 25.79, longitude: 100.19 },
  '舟山市 · 朱家尖': { latitude: 29.95, longitude: 122.38 },
};

export function buildSampleEntries(now = Date.now()): Entry[] {
  return SEEDS.map(s => {
    const d = new Date(now);
    d.setDate(d.getDate() - s.daysAgo);
    d.setHours(s.hour, s.minute, 0, 0);
    const t = Math.min(d.getTime(), now - 60000);
    return {
      id: uid('e'),
      title: s.title,
      body: s.body,
      createdAt: t,
      updatedAt: t,
      mood: s.mood,
      tags: s.tags,
      people: [],
      photos: s.photos ?? [],
      audios: [],
      videos: [],
      weather: s.weather,
      temperature: s.temperature,
      place: s.place ? { name: s.place, ...(PLACE_COORDS[s.place] ?? {}) } : undefined,
      favorite: !!s.favorite,
      pinned: !!s.pinned,
      hidden: false,
      status: 'published',
    } satisfies Entry;
  });
}

export function buildSampleDrafts(now = Date.now()): Entry[] {
  const mk = (minsAgo: number, title: string, body: string, photo?: string): Entry => {
    const t = now - minsAgo * 60000;
    return {
      id: uid('e'), title, body, createdAt: t, updatedAt: t, tags: [], people: [], photos: photo ? [photo] : [], audios: [], videos: [],
      favorite: false, pinned: false, hidden: false, status: 'draft',
    };
  };
  return [
    mk(90, '一次临时起意的旅行', '继续写：想要记录那条路上遇到的人…', 'asset:photo-road'),
    mk(60 * 26, '新年的小目标', '继续写：具体的行动计划还没想好…', 'asset:photo-cloud'),
  ];
}
