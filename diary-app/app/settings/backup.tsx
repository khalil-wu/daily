import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { Cloud, Download, HardDrive, Lock, Upload } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { actions, useStore } from '../../src/store/store';
import { Button, Field, Group, NavBar, Row, Screen, Switch } from '../../src/components/ui';
import { BottomSheet } from '../../src/components/motion';
import { buildSnapshotPayload, listAutoBackups, readAutoBackup, writeAutoBackup, type AutoBackupInfo } from '../../src/services/autoBackup';
import { decryptBackup, encryptBackup, isEncryptedBackup, WrongPasswordError } from '../../src/utils/backupCrypto';
import { useFeedback } from '../../src/components/feedback';
import { fmtDateTime } from '../../src/utils/date';
import { exportTextFile, pickAndReadTextFile } from '../../src/utils/transfer';
import { cloudConfigured } from '../../src/services/cloud';

/** 10. 备份与恢复（1:1 复刻设计稿3 #10） */
export default function BackupScreen() {
  const { c, fs } = useTheme();
  const { toast, confirm } = useFeedback();
  const sync = useStore(s => s.sync);
  const backup = useStore(s => s.backup);
  const account = useStore(s => s.account);
  const encryptOn = useStore(s => s.privacy.encryptBackup);
  const [busy, setBusy] = useState(false);
  // 密码面板：备份时输入两次设置密码；恢复加密文件时输入一次
  const [pw, setPw] = useState<{ mode: 'set' | 'unlock' } | null>(null);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwErr, setPwErr] = useState('');
  const pendingFile = useRef<any>(null);
  const [autoList, setAutoList] = useState<AutoBackupInfo[]>([]);
  const refreshAuto = () => void listAutoBackups().then(setAutoList);
  useEffect(refreshAuto, []);

  const toggleAuto = async (v: boolean) => {
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
    try {
      await applyRestore(await readAutoBackup(info.id));
    } catch (e: any) {
      toast(e?.message || '读取自动备份失败', { type: 'error' });
    }
  };

  const openPw = (mode: 'set' | 'unlock') => {
    setPw1('');
    setPw2('');
    setPwErr('');
    setPw({ mode });
  };

  const writeBackup = async (password?: string) => {
    setBusy(true);
    try {
      const snap = actions.snapshot();
      // 完整快照（含日记本、目标、设置），恢复时由 normalizeState 补齐
      const plain = buildSnapshotPayload(snap);
      const count = snap.entries.filter(e => !e.deletedAt).length;
      const payload = password ? await encryptBackup(plain, password, count) : JSON.stringify(plain, null, 2);
      const name = `jide-diary-backup-${new Date().toISOString().slice(0, 10)}${password ? '-encrypted' : ''}.json`;
      const res = await exportTextFile(name, payload, 'application/json');
      if (res.ok) {
        actions.setBackup({ lastBackupAt: Date.now(), lastBackupPath: res.path });
        toast('本地备份成功', { message: password ? '已生成加密备份，恢复时需要输入密码' : '已生成完整 JSON 备份文件' });
      } else {
        toast(res.message || '备份失败', { type: 'error' });
      }
    } catch (e: any) {
      toast(e?.message || '备份失败', { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const manualBackup = () => {
    if (busy) return;
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
      message: '合并恢复会保留本机已有日记，并补上备份里更新或缺少的内容。',
      confirmText: '合并恢复',
      cancelText: '取消',
    });
    if (!ok) return;
    const count = actions.restoreSnapshot(parsed, 'merge');
    toast('恢复成功', { message: `已从备份文件合并恢复 ${count} 篇日记` });
  };

  const submitPw = async () => {
    if (!pw) return;
    if (pw.mode === 'set') {
      if (pw1.length < 6) return setPwErr('密码至少 6 位');
      if (pw1 !== pw2) return setPwErr('两次输入的密码不一致');
      const p = pw1;
      setPw(null);
      await writeBackup(p);
      return;
    }
    setBusy(true);
    try {
      const data = await decryptBackup(pendingFile.current, pw1);
      setPw(null);
      pendingFile.current = null;
      await applyRestore(data);
    } catch (e) {
      setPwErr(e instanceof WrongPasswordError ? e.message : '解密失败，请确认文件完整');
    } finally {
      setBusy(false);
    }
  };

  const restoreBackup = async () => {
    try {
      const picked = await pickAndReadTextFile(['application/json', 'text/plain', '*/*']);
      if (!picked) return;
      const parsed = JSON.parse(picked.content);
      if (isEncryptedBackup(parsed)) {
        pendingFile.current = parsed;
        openPw('unlock');
        return;
      }
      await applyRestore(parsed);
    } catch {
      toast('解析备份文件失败，请确认文件格式', { type: 'error' });
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar variant="large" title="备份与恢复" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}>
        <Group footer={cloudConfigured() ? '同步会把日记上传到云端账号；照片、视频与录音暂不上传，换设备请用「手动备份」带走。' : '目前还没有接入云端服务器：同步只在这台设备的账号之间进行，换手机请用下面的「手动备份」带走数据。'}>
          <Row
            icon={Cloud}
            iconColor={c.primaryDark}
            title={cloudConfigured() ? '云端同步' : '账号同步（本机）'}
            subtitle={cloudConfigured() ? '登录账号后，日记会同步到云端并在多设备间保持一致' : '在本机账号之间同步日记，处理修改冲突'}
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
            onPress={() => {
              if (!account) router.push('/auth/login');
              else void actions.syncNow().then(r => (r.conflicts ? router.push('/sync-conflict') : toast('同步完成')));
            }}
          />
        </Group>

        <Group title="本地备份">
          <Row
            icon={Download}
            iconColor={c.primaryDark}
            title="手动备份"
            subtitle={busy ? '正在生成备份…' : encryptOn ? '生成需要密码才能打开的加密备份' : '立即将数据备份到本机文件'}
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
            subtitle="从备份文件恢复日记与设置"
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
