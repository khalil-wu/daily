import { HiddenAccessBoundary } from '../../src/components/HiddenAccessBoundary';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { Text } from '../../src/components/text';
import { router } from 'expo-router';
import { Cloud, Download, HardDrive, Lock, Upload } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions, useStore } from '../../src/store/store';
import { Button, Field, Group, NavBar, Row, Screen, Switch } from '../../src/components/ui';
import { BottomSheet } from '../../src/components/motion';
import { listAutoBackups, readAutoBackup, writeAutoBackup, type AutoBackupInfo } from '../../src/services/autoBackup';
import { createPortableBackup, restorePortableBackup, MAX_BACKUP_FILE_BYTES } from '../../src/services/backupMedia';
import { accountSpaceKey } from '../../src/store/accountSpaces';
import { flushPendingState, getPersistenceError } from '../../src/store/storage';
import { decryptBackup, encryptBackup, isEncryptedBackup, WrongPasswordError, _utf8Encode } from '../../src/utils/backupCrypto';
import { useFeedback } from '../../src/components/feedback';
import { fmtDateTime } from '../../src/utils/date';
import { exportTextFile, pickAndReadTextFile } from '../../src/utils/transfer';
import { cloudConfigured } from '../../src/services/cloud';

/** 10. 备份与恢复（1:1 复刻设计稿3 #10） */
export default function BackupScreen() { return <HiddenAccessBoundary required><BackupScreenContent /></HiddenAccessBoundary>; }

function BackupScreenContent() {
  const { c, fs } = useTheme();
  const { toast, confirm } = useFeedback();
  const sync = useStore(s => s.sync);
  const backup = useStore(s => s.backup);
  const account = useStore(s => s.account);
  const encryptOn = useStore(s => s.privacy.encryptBackup);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const busyRef = useRef(false);
  const begin = (label: string) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setBusyLabel(label);
    return true;
  };
  const finish = () => { busyRef.current = false; setBusy(false); setBusyLabel(''); };
  const ensureSaved = async () => {
    await flushPendingState();
    const error = getPersistenceError();
    if (error) throw new Error(error);
  };
  // 密码面板：备份时输入两次设置密码；恢复加密文件时输入一次
  const [pw, setPw] = useState<{ mode: 'set' | 'unlock' } | null>(null);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwErr, setPwErr] = useState('');
  const pendingFile = useRef<any>(null);
  const [autoList, setAutoList] = useState<AutoBackupInfo[]>([]);
  const refreshAuto = () => void listAutoBackups(accountSpaceKey(account)).then(setAutoList);
  useEffect(refreshAuto, [account?.id]);

  const toggleAuto = async (v: boolean) => {
    if (busyRef.current) return;
    actions.setBackup({ auto: v });
    // 打开时立刻留第一份，用户马上能看到它在工作
    if (v && !autoList.length && actions.snapshot().entries.length) {
      try {
        await writeAutoBackup(actions.snapshot());
        actions.setBackup({ lastBackupAt: Date.now() });
        refreshAuto();
        toast('自动备份已开启', { message: '已在本机留下第一份快照，之后每 7 天一份' });
      } catch (e: any) {
        toast(e?.message || '自动备份失败', { type: 'error' });
      }
    }
  };

  const restoreAuto = async (info: AutoBackupInfo) => {
    if (!begin('正在读取自动快照…')) return;
    try {
      await applyRestore(await readAutoBackup(info.id, accountSpaceKey(account)));
    } catch (e: any) {
      toast(e?.message || '读取自动备份失败', { type: 'error' });
    } finally {
      finish();
    }
  };

  const openPw = (mode: 'set' | 'unlock') => {
    setPw1('');
    setPw2('');
    setPwErr('');
    setPw({ mode });
  };

  const writeBackup = async (password?: string) => {
    if (!begin('正在打包日记与附件…')) return;
    try {
      await ensureSaved();
      const snap = actions.snapshot();
      const plain = await createPortableBackup(snap);
      const count = snap.entries.filter(e => !e.deletedAt).length;
      setBusyLabel(password ? '正在加密备份…' : '正在生成备份文件…');
      const payload = password ? await encryptBackup(plain, password, count) : JSON.stringify(plain);
      if (payload.length > MAX_BACKUP_FILE_BYTES || (typeof TextEncoder === 'undefined' ? _utf8Encode(payload) : new TextEncoder().encode(payload)).byteLength > MAX_BACKUP_FILE_BYTES) throw new Error('备份文件超过 50 MiB，请减少附件后再试');
      const name = `jide-diary-backup-${new Date().toISOString().slice(0, 10)}${password ? '-encrypted' : ''}.json`;
      const res = await exportTextFile(name, payload, 'application/json');
      if (res.ok) {
        actions.setBackup({ lastBackupAt: Date.now(), lastBackupPath: res.path });
        await ensureSaved();
        toast('本地备份成功', { message: `已生成${password ? '加密' : ''}备份，包含 ${count} 篇日记和 ${plain.media.length} 个附件` });
      } else {
        toast(res.message || '备份失败', { type: 'error' });
      }
    } catch (e: any) {
      toast(e?.message || '备份失败', { type: 'error' });
    } finally {
      finish();
    }
  };

  const manualBackup = () => {
    if (busyRef.current) return;
    if (encryptOn) openPw('set');
    else void writeBackup();
  };

  const applyRestore = async (parsed: any) => {
    if (!parsed || !Array.isArray(parsed.entries)) {
      toast('文件不是有效的记得日记备份', { type: 'error' });
      return;
    }
    const ok = await confirm({
      title: `检测到 ${parsed.entries.length} 篇日记`,
      message: parsed.mediaVersion === 1
        ? '先将照片、视频和录音存入这台设备，再合并日记。保留本机已有内容，补上备份里更新或缺少的内容。'
        : '这是本机快照或旧格式备份，只包含文字与原设备附件位置。跨设备时附件可能无法显示；合并会保留本机已有日记。',
      confirmText: '合并恢复',
      cancelText: '取消',
    });
    if (!ok) return;
    setBusyLabel('正在恢复附件与日记…');
    const restored = await restorePortableBackup(parsed);
    const count = actions.restoreSnapshot(restored.snapshot, 'merge');
    await ensureSaved();
    toast('恢复成功', { message: `已合并 ${count} 篇日记${restored.legacy ? '；旧格式附件仅在原设备可用' : `，还原 ${restored.mediaCount} 个附件`}` });
  };

  const submitPw = async () => {
    if (!pw) return;
    if (busyRef.current) return;
    if (pw.mode === 'set') {
      if (pw1.length < 6) return setPwErr('密码至少 6 位');
      if (pw1 !== pw2) return setPwErr('两次输入的密码不一致');
      const p = pw1;
      setPw(null);
      await writeBackup(p);
      return;
    }
    if (!begin('正在解密备份…')) return;
    try {
      const data = await decryptBackup(pendingFile.current, pw1);
      setPw(null);
      pendingFile.current = null;
      await applyRestore(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : '恢复失败，请确认文件完整';
      if (e instanceof WrongPasswordError) setPwErr(message);
      else toast(message, { type: 'error' });
    } finally {
      finish();
    }
  };

  const restoreBackup = async () => {
    if (!begin('正在读取备份文件…')) return;
    try {
      const picked = await pickAndReadTextFile(['application/json', 'text/plain', '*/*'], MAX_BACKUP_FILE_BYTES);
      if (!picked) return;
      const parsed = JSON.parse(picked.content.replace(/^\uFEFF/, ''));
      if (isEncryptedBackup(parsed)) {
        pendingFile.current = parsed;
        openPw('unlock');
        return;
      }
      await applyRestore(parsed);
    } catch (e) {
      toast(e instanceof Error ? e.message : '解析备份文件失败，请确认文件格式', { type: 'error' });
    } finally {
      finish();
    }
  };

  const syncNow = async () => {
    if (!account) return router.push('/auth/login');
    if (!begin('正在同步…')) return;
    try {
      const result = await actions.syncNow();
      if (!result.ok) return toast(result.message || '同步失败，请稍后重试', { type: 'error' });
      await ensureSaved();
      if (result.conflicts) router.push('/sync-conflict');
      else toast(result.partial ? '部分内容已同步，其他类别的同步已关闭' : account.remote ? '同步完成' : '本机账号快照已更新');
    } catch (e) {
      toast(e instanceof Error ? e.message : '同步失败，请稍后重试', { type: 'error' });
    } finally { finish(); }
  };

  return (
    <Screen enter="page" edges={['top', 'bottom']}>
      <NavBar variant="large" title="备份与恢复" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}>
        <Group footer={cloudConfigured() ? '同步按账号独立保存；在「账号与同步」中开启附件后，照片、视频与录音也会上传，失败时会保留本机版本。' : '目前还没有接入云端服务器：同步只保存当前本机账号的快照，换手机请用下面的「手动备份」带走数据。'}>
          <Row
            icon={Cloud}
            iconColor={c.primaryDark}
            title={cloudConfigured() ? '云端同步' : '账号同步（本机）'}
            subtitle={cloudConfigured() ? '登录账号后，日记会同步到云端并在多设备间保持一致' : '当前账号的本机快照，不可用于跨设备同步'}
            right={
              <Switch
                value={sync.cloud}
                onChange={v => {
                  if (v && !account) {
                    toast('请先登录账号', { type: 'info' });
                    router.push('/auth/login');
                    return;
                  }
                  actions.setSync({ cloud: v });
                }}
              />
            }
          />
          <Row
            title="最近同步"
            value={sync.lastSyncAt ? `${fmtDateTime(sync.lastSyncAt)} · 已同步` : '未同步'}
            onPress={() => void syncNow()}
          />
        </Group>

        <Group title="本地备份" footer="手动备份包含照片、视频、录音与封面，可带到其他设备。附件合计上限 25 MiB，备份文件上限 50 MiB。自动快照只保留本机数据与附件位置，卸载或清理浏览器后无法找回。">
          <Row
            icon={Download}
            iconColor={c.primaryDark}
            title="手动备份"
            subtitle={busy ? busyLabel : encryptOn ? '将日记与附件打包为加密备份' : '将日记与真实附件打包带走'}
            value={encryptOn ? '已加密' : undefined}
            onPress={manualBackup}
          />
          <Row
            icon={HardDrive}
            iconColor={c.primaryDark}
            title="自动备份"
            subtitle={autoList.length ? `每 7 天一份，本机已存 ${autoList.length} 份` : '每 7 天在本机留一份快照'}
            right={<Switch value={backup.auto} onChange={v => void toggleAuto(v)} />}
          />
          <Row
            title="最近备份时间"
            value={backup.lastBackupAt ? fmtDateTime(backup.lastBackupAt) : '暂无记录'}
          />
        </Group>

        <Group>
          <Row
            icon={Upload}
            iconColor={c.primaryDark}
            title="恢复数据"
            subtitle={busy ? busyLabel : '从备份文件恢复日记、附件与日记本'}
            onPress={() => void restoreBackup()}
          />
        </Group>

        {autoList.length > 0 && (
          <Group title="本机自动快照">
            {autoList.map(a => (
              <Row key={a.id} title={fmtDateTime(a.at)} value={`${a.count} 篇 · 恢复`} onPress={() => void restoreAuto(a)} />
            ))}
          </Group>
        )}
      </ScrollView>

      <BottomSheet visible={!!pw} onClose={() => setPw(null)} title={pw?.mode === 'set' ? '设置备份密码' : '输入备份密码'} keyboard>
        <Text style={{ fontSize: fs(13), color: c.textSub, lineHeight: fs(13) * 1.6, marginBottom: 14 }}>
          {pw?.mode === 'set'
            ? '备份会用这个密码加密。密码不会保存在任何地方，忘记后备份将无法打开。'
            : `这份备份已加密${pendingFile.current?.count ? `（${pendingFile.current.count} 篇日记）` : ''}，请输入备份时设置的密码。`}
        </Text>
        <Field
          icon={Lock}
          secure
          value={pw1}
          onChangeText={v => { setPw1(v); setPwErr(''); }}
          placeholder={pw?.mode === 'set' ? '设置密码（至少 6 位）' : '备份密码'}
          autoFocus
          onSubmitEditing={() => void submitPw()}
        />
        {pw?.mode === 'set' && (
          <Field icon={Lock} secure value={pw2} onChangeText={v => { setPw2(v); setPwErr(''); }} placeholder="再输入一次" onSubmitEditing={() => void submitPw()} />
        )}
        {!!pwErr && <Text style={{ fontSize: fs(12.5), color: c.danger, marginTop: -4, marginBottom: 10 }}>{pwErr}</Text>}
        <Button title={pw?.mode === 'set' ? '加密并备份' : busy ? '正在解密…' : '解密并恢复'} loading={busy} onPress={() => void submitPw()} style={{ marginTop: 6 }} />
      </BottomSheet>
    </Screen>
  );
}
