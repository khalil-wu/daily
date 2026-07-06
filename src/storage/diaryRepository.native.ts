import { CommunityPost, MemoryAttachment, MemoryPrivacyMode, MemorySummary, PersonSummary, communityPosts as seedCommunityPosts, memories as seedMemories, people as seedPeople } from '@/src/data/mock';
import { normalizeAttachments, normalizeAvatarUri, normalizeTags, normalizeVoiceNotes } from '@/src/data/normalizeDiaryFields';
import { normalizeLocation } from '@/src/location/locationLabel';

export type DiaryData = {
  people: PersonSummary[];
  memories: MemorySummary[];
  communityPosts?: CommunityPost[];
};

const DB_NAME = 'remember-diary.db';
const SCHEMA_VERSION = 10;

type SQLiteModule = typeof import('expo-sqlite');
type SQLiteDatabase = Awaited<ReturnType<SQLiteModule['openDatabaseAsync']>>;

type PersonRow = {
  id: string;
  name: string;
  relation: string;
  note: string;
  memoryCount: number;
  lastDate: string;
  recent: number;
  stars: number;
  position: number;
  isPrivate: number;
  privacyMode: string | null;
  avatarUri: string | null;
};

type MemoryRow = {
  id: string;
  personId: string | null;
  title: string;
  content: string | null;
  excerpt: string;
  mediaJson: string | null;
  date: string;
  year: string;
  mood: string;
  hasMedia: number | null;
  isPrivate: number | null;
  privacyMode: string | null;
  locationJson: string | null;
  tagsJson: string | null;
  voiceNotesJson: string | null;
  position: number;
};

type MemoryPersonRow = {
  memoryId: string;
  personId: string;
  position: number;
};

type CommunityPostRow = {
  id: string;
  memoryId: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  mood: string | null;
  attachmentUri: string | null;
  likes: number;
  comments: number;
  followedByMe: number | null;
  likedByMe: number | null;
  repostedByMe: number | null;
  position: number;
};

let dbPromise: Promise<SQLiteDatabase> | null = null;
let saveChain = Promise.resolve();

function cloneSeedData(): DiaryData {
  return {
    people: seedPeople.map((person) => ({ ...person, avatarUri: person.avatarUri ?? null })),
    communityPosts: seedCommunityPosts.map((post) => ({ ...post })),
    memories: seedMemories.map((memory) => ({
      ...memory,
      personIds: [...memory.personIds],
      attachments: [...memory.attachments],
      voiceNotes: [...(memory.voiceNotes ?? [])],
      tags: [...(memory.tags ?? [])],
    })),
  };
}

function normalizeDiaryData(data: DiaryData): DiaryData {
  return {
    people: data.people.map((person) => ({ ...person, avatarUri: normalizeAvatarUri(person.avatarUri) })),
    communityPosts: normalizeCommunityPosts(data.communityPosts),
    memories: data.memories.map((memory) => {
      const personIds = memory.personIds?.length
        ? memory.personIds
        : memory.personId
          ? [memory.personId]
          : [];
      return {
        ...memory,
        personId: personIds[0] ?? null,
        personIds: [...personIds],
        content: memory.content ?? memory.excerpt,
        attachments: normalizeAttachments(memory.attachments),
        voiceNotes: normalizeVoiceNotes(memory.voiceNotes),
        tags: normalizeTags(memory.tags),
        hasMedia: Boolean(memory.hasMedia || memory.attachments?.length),
        isPrivate: Boolean(memory.isPrivate),
        privacyMode: memory.isPrivate ? normalizePrivacyMode(memory.privacyMode) : undefined,
        location: normalizeLocation(memory.location),
      };
    }),
  };
}

function normalizeCommunityPosts(posts?: CommunityPost[]): CommunityPost[] {
  return (posts ?? []).map((post) => ({
    ...post,
    attachmentUri: post.attachmentUri ?? null,
    likes: typeof post.likes === 'number' ? post.likes : 0,
    comments: typeof post.comments === 'number' ? post.comments : 0,
    followedByMe: Boolean(post.followedByMe),
    likedByMe: Boolean(post.likedByMe),
    repostedByMe: Boolean(post.repostedByMe),
  }));
}

function normalizePrivacyMode(mode?: MemoryPrivacyMode | null): MemoryPrivacyMode {
  return mode === 'masked' ? 'masked' : 'hidden';
}

function parseMediaJson(value: string | null): MemoryAttachment[] {
  if (!value) return [];
  try {
    return normalizeAttachments(JSON.parse(value) as MemoryAttachment[]);
  } catch {
    return [];
  }
}

function parseLocationJson(value: string | null) {
  if (!value) return null;
  try {
    return normalizeLocation(JSON.parse(value) as unknown);
  } catch {
    return null;
  }
}

function parseVoiceNotesJson(value: string | null) {
  if (!value) return [];
  try {
    return normalizeVoiceNotes(JSON.parse(value) as unknown);
  } catch {
    return [];
  }
}

function parseTagsJson(value: string | null): string[] {
  if (!value) return [];
  try {
    return normalizeTags(JSON.parse(value) as unknown);
  } catch {
    return [];
  }
}

async function openDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = import('expo-sqlite').then(async (SQLite) => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await migrateDb(db);
      return db;
    });
  }
  return dbPromise;
}

async function migrateDb(db: SQLiteDatabase): Promise<void> {
  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = versionRow?.user_version ?? 0;
  if (currentVersion >= SCHEMA_VERSION) return;

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  if (currentVersion === 0) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS persons (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        relation TEXT NOT NULL,
        note TEXT NOT NULL,
        memoryCount INTEGER NOT NULL,
        lastDate TEXT NOT NULL,
        recent INTEGER NOT NULL,
        stars INTEGER NOT NULL,
        position INTEGER NOT NULL,
        isPrivate INTEGER NOT NULL DEFAULT 0,
        privacyMode TEXT,
        avatar_uri TEXT
      );

      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY NOT NULL,
        personId TEXT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        excerpt TEXT NOT NULL,
        mediaJson TEXT NOT NULL DEFAULT '[]',
        date TEXT NOT NULL,
        year TEXT NOT NULL,
        mood TEXT NOT NULL,
        hasMedia INTEGER,
        isPrivate INTEGER NOT NULL DEFAULT 0,
        privacyMode TEXT,
        locationJson TEXT,
        tags TEXT,
        voice_notes TEXT,
        position INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS memory_persons (
        memoryId TEXT NOT NULL,
        personId TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (memoryId, personId),
        FOREIGN KEY (memoryId) REFERENCES memories(id) ON DELETE CASCADE,
        FOREIGN KEY (personId) REFERENCES persons(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_memory_persons_person ON memory_persons(personId);

      CREATE TABLE IF NOT EXISTS community_posts (
        id TEXT PRIMARY KEY NOT NULL,
        memoryId TEXT NOT NULL,
        title TEXT NOT NULL,
        excerpt TEXT NOT NULL,
        content TEXT NOT NULL,
        date TEXT NOT NULL,
        mood TEXT,
        attachmentUri TEXT,
        likes INTEGER NOT NULL DEFAULT 0,
        comments INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL
      );
    `);
  }

  if (currentVersion === 1) {
    await db.execAsync(`
      ALTER TABLE memories ADD COLUMN content TEXT NOT NULL DEFAULT '';
      UPDATE memories SET content = excerpt WHERE content = '';
    `);
  }

  if (currentVersion <= 2) {
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(memories)');
    const hasMediaJson = columns.some((column) => column.name === 'mediaJson');
    if (!hasMediaJson) {
      await db.execAsync(`ALTER TABLE memories ADD COLUMN mediaJson TEXT NOT NULL DEFAULT '[]';`);
    }
  }

  if (currentVersion <= 3) {
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(memories)');
    const hasIsPrivate = columns.some((column) => column.name === 'isPrivate');
    if (!hasIsPrivate) {
      await db.execAsync(`ALTER TABLE memories ADD COLUMN isPrivate INTEGER NOT NULL DEFAULT 0;`);
    }
  }

  if (currentVersion <= 4) {
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(memories)');
    const hasPrivacyMode = columns.some((column) => column.name === 'privacyMode');
    if (!hasPrivacyMode) {
      await db.execAsync(`ALTER TABLE memories ADD COLUMN privacyMode TEXT;`);
    }
  }

  if (currentVersion <= 5) {
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(memories)');
    const hasLocationJson = columns.some((column) => column.name === 'locationJson');
    if (!hasLocationJson) {
      await db.execAsync(`ALTER TABLE memories ADD COLUMN locationJson TEXT;`);
    }
  }

  if (currentVersion <= 6) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS community_posts (
        id TEXT PRIMARY KEY NOT NULL,
        memoryId TEXT NOT NULL,
        title TEXT NOT NULL,
        excerpt TEXT NOT NULL,
        content TEXT NOT NULL,
        date TEXT NOT NULL,
        mood TEXT,
        attachmentUri TEXT,
        likes INTEGER NOT NULL DEFAULT 0,
        comments INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL
      );
    `);
  }

  if (currentVersion <= 7) {
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(persons)');
    const hasIsPrivate = columns.some((column) => column.name === 'isPrivate');
    if (!hasIsPrivate) {
      await db.execAsync(`ALTER TABLE persons ADD COLUMN isPrivate INTEGER NOT NULL DEFAULT 0;`);
    }
    const hasPrivacyMode = columns.some((column) => column.name === 'privacyMode');
    if (!hasPrivacyMode) {
      await db.execAsync(`ALTER TABLE persons ADD COLUMN privacyMode TEXT;`);
    }
  }

  if (currentVersion <= 8) {
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(community_posts)');
    const hasFollowedByMe = columns.some((column) => column.name === 'followedByMe');
    if (!hasFollowedByMe) {
      await db.execAsync(`ALTER TABLE community_posts ADD COLUMN followedByMe INTEGER NOT NULL DEFAULT 0;`);
    }
    const hasLikedByMe = columns.some((column) => column.name === 'likedByMe');
    if (!hasLikedByMe) {
      await db.execAsync(`ALTER TABLE community_posts ADD COLUMN likedByMe INTEGER NOT NULL DEFAULT 0;`);
    }
    const hasRepostedByMe = columns.some((column) => column.name === 'repostedByMe');
    if (!hasRepostedByMe) {
      await db.execAsync(`ALTER TABLE community_posts ADD COLUMN repostedByMe INTEGER NOT NULL DEFAULT 0;`);
    }
  }

  if (currentVersion <= 9) {
    const personColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(persons)');
    const hasAvatarUri = personColumns.some((column) => column.name === 'avatar_uri');
    if (!hasAvatarUri) {
      await db.execAsync(`ALTER TABLE persons ADD COLUMN avatar_uri TEXT;`);
    }

    const memoryColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(memories)');
    const hasTags = memoryColumns.some((column) => column.name === 'tags');
    if (!hasTags) {
      await db.execAsync(`ALTER TABLE memories ADD COLUMN tags TEXT;`);
    }
    const hasVoiceNotes = memoryColumns.some((column) => column.name === 'voice_notes');
    if (!hasVoiceNotes) {
      await db.execAsync(`ALTER TABLE memories ADD COLUMN voice_notes TEXT;`);
    }
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

async function loadNativeData(): Promise<DiaryData> {
  const db = await openDb();
  const peopleRows = await db.getAllAsync<PersonRow>(
    `SELECT id, name, relation, note, memoryCount, lastDate, recent, stars, position,
      isPrivate, privacyMode, avatar_uri AS avatarUri
      FROM persons ORDER BY position ASC`,
  );
  const memoryRows = await db.getAllAsync<MemoryRow>(
    `SELECT id, personId, title, content, excerpt, mediaJson, date, year, mood, hasMedia,
      isPrivate, privacyMode, locationJson, tags AS tagsJson, voice_notes AS voiceNotesJson, position
      FROM memories ORDER BY position ASC`,
  );
  const linkRows = await db.getAllAsync<MemoryPersonRow>('SELECT * FROM memory_persons ORDER BY position ASC');
  const communityRows = await db.getAllAsync<CommunityPostRow>('SELECT * FROM community_posts ORDER BY position ASC');

  if (peopleRows.length === 0 && memoryRows.length === 0) {
    const seed = cloneSeedData();
    await writeNativeData(seed);
    return seed;
  }

  const linksByMemory = linkRows.reduce<Record<string, string[]>>((acc, row) => {
    (acc[row.memoryId] ??= []).push(row.personId);
    return acc;
  }, {});

  return {
    people: peopleRows.map((row) => ({
      id: row.id,
      name: row.name,
      relation: row.relation,
      note: row.note,
      memoryCount: row.memoryCount,
      lastDate: row.lastDate,
      recent: Boolean(row.recent),
      stars: row.stars,
      isPrivate: Boolean(row.isPrivate),
      privacyMode: row.isPrivate
        ? (row.privacyMode === 'masked' ? 'masked' : 'hidden')
        : undefined,
      avatarUri: normalizeAvatarUri(row.avatarUri),
    })),
    memories: memoryRows.map((row) => {
      const personIds = linksByMemory[row.id] ?? (row.personId ? [row.personId] : []);
      const attachments = parseMediaJson(row.mediaJson);
      return {
        id: row.id,
        personId: personIds[0] ?? null,
        personIds,
        title: row.title,
        excerpt: row.excerpt,
        content: row.content ?? row.excerpt,
        attachments,
        date: row.date,
        year: row.year,
        mood: row.mood,
        hasMedia: Boolean(row.hasMedia || attachments.length),
        voiceNotes: parseVoiceNotesJson(row.voiceNotesJson),
        tags: parseTagsJson(row.tagsJson),
        isPrivate: Boolean(row.isPrivate),
        privacyMode: row.isPrivate ? normalizePrivacyMode(row.privacyMode as MemoryPrivacyMode | null) : undefined,
        location: parseLocationJson(row.locationJson),
      };
    }),
    communityPosts: communityRows.map((row) => ({
      id: row.id,
      memoryId: row.memoryId,
      title: row.title,
      excerpt: row.excerpt,
      content: row.content,
      date: row.date,
      mood: row.mood,
      attachmentUri: row.attachmentUri,
      likes: row.likes,
      comments: row.comments,
      followedByMe: Boolean(row.followedByMe),
      likedByMe: Boolean(row.likedByMe),
      repostedByMe: Boolean(row.repostedByMe),
    })),
  };
}

async function writeNativeData(data: DiaryData): Promise<void> {
  const db = await openDb();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync(`
      DELETE FROM memory_persons;
      DELETE FROM community_posts;
      DELETE FROM memories;
      DELETE FROM persons;
    `);

    for (const [position, person] of data.people.entries()) {
      await txn.runAsync(
        `INSERT INTO persons
          (id, name, relation, note, memoryCount, lastDate, recent, stars, position, isPrivate, privacyMode, avatar_uri)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        person.id,
        person.name,
        person.relation,
        person.note,
        person.memoryCount,
        person.lastDate,
        person.recent ? 1 : 0,
        person.stars,
        position,
        person.isPrivate ? 1 : 0,
        person.isPrivate ? (person.privacyMode ?? 'hidden') : null,
        normalizeAvatarUri(person.avatarUri),
      );
    }

    for (const [position, memory] of data.memories.entries()) {
      await txn.runAsync(
        `INSERT INTO memories
          (id, personId, title, content, excerpt, mediaJson, date, year, mood, hasMedia, isPrivate, privacyMode, locationJson, tags, voice_notes, position)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        memory.id,
        memory.personId,
        memory.title,
        memory.content,
        memory.excerpt,
        JSON.stringify(memory.attachments),
        memory.date,
        memory.year,
        memory.mood,
        memory.hasMedia || memory.attachments.length > 0 ? 1 : 0,
        memory.isPrivate ? 1 : 0,
        memory.isPrivate ? normalizePrivacyMode(memory.privacyMode) : null,
        memory.location ? JSON.stringify(memory.location) : null,
        JSON.stringify(normalizeTags(memory.tags)),
        JSON.stringify(normalizeVoiceNotes(memory.voiceNotes)),
        position,
      );

      for (const [linkPosition, personId] of memory.personIds.entries()) {
        await txn.runAsync(
          'INSERT INTO memory_persons (memoryId, personId, position) VALUES (?, ?, ?)',
          memory.id,
          personId,
          linkPosition,
        );
      }
    }

    for (const [position, post] of normalizeCommunityPosts(data.communityPosts).entries()) {
      await txn.runAsync(
        `INSERT INTO community_posts
          (id, memoryId, title, excerpt, content, date, mood, attachmentUri, likes, comments, followedByMe, likedByMe, repostedByMe, position)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        post.id,
        post.memoryId,
        post.title,
        post.excerpt,
        post.content,
        post.date,
        post.mood ?? null,
        post.attachmentUri ?? null,
        post.likes,
        post.comments,
        post.followedByMe ? 1 : 0,
        post.likedByMe ? 1 : 0,
        post.repostedByMe ? 1 : 0,
        position,
      );
    }
  });
}

export async function loadDiaryData(): Promise<DiaryData> {
  return loadNativeData();
}

export function saveDiaryData(data: DiaryData): Promise<void> {
  const nextSave = saveChain
    .catch(() => undefined)
    .then(() => writeNativeData(normalizeDiaryData(data)));
  saveChain = nextSave.catch(() => undefined);
  return nextSave;
}
