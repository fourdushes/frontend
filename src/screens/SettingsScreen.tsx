import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { readableError } from '../api/client';
import { teamApi } from '../api/teamApi';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  LoadingState,
  Notice,
  PageHeader,
  roleLabel,
  Screen,
  Section,
  StatusBadge,
  Tabs,
  uiStyles,
} from '../components/Ui';
import { useSession } from '../context/SessionContext';
import { RootStackParamList } from '../navigation';
import { colors, fontFamily, radius, spacing } from '../theme/theme';
import { ConnectedGuardian, ConnectedWard, MyPage } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;
type SettingsTab = 'PROFILE' | 'RELATIONS';
type Relation = ConnectedGuardian | ConnectedWard;

export function SettingsScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const { session, signOut } = useSession();
  const isInstitution = session?.userType === 'INSTITUTIONS';
  const isWard = session?.userType === 'WARD';
  const [tab, setTab] = useState<SettingsTab>('PROFILE');
  const [profile, setProfile] = useState<MyPage | null>(null);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<Relation | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const profileResult = await teamApi.getMyPage(session.userType);
      setProfile(profileResult);
      setName(profileResult.username);

      if (session.userType === 'WARD') {
        const relationResult = await teamApi.getConnectedGuardians();
        setRelations(relationResult.guardSearchList ?? []);
      } else if (session.userType === 'GUARDIAN') {
        const relationResult = await teamApi.getConnectedWards();
        setRelations(relationResult.wardSearchList ?? []);
      }
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveName() {
    const nextName = name.trim();
    if (!nextName || nextName === profile?.username || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await teamApi.changeName(nextName);
      setProfile((current) => current ? { ...current, username: nextName } : current);
      setSuccess('이름을 변경했습니다.');
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setSaving(false);
    }
  }

  async function chooseMainGuardian(relation: Relation) {
    if (!('guardUserId' in relation) || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await teamApi.setMainGuardian(relation.guardUserId);
      setSuccess(`${relation.guardUserName}님을 메인 보호자로 설정했습니다.`);
      await load();
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setSaving(false);
    }
  }

  async function removeRelation() {
    if (!pendingRemoval || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await teamApi.deleteCareRelation(pendingRemoval.careId);
      setPendingRemoval(null);
      setSuccess('케어 연결을 해제했습니다.');
      await load();
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: 'MainPreview' }] });
  }

  const selectedName = pendingRemoval
    ? 'guardUserName' in pendingRemoval
      ? pendingRemoval.guardUserName
      : pendingRemoval.wardUserName
    : '';

  return (
    <Screen>
      <PageHeader
        eyebrow="MY HEARO"
        title="내 정보"
        description="계정 정보와 가족 연결은 서버에 저장된 실제 데이터를 기준으로 보여드립니다."
        actions={<Button title="로그아웃" tone="secondary" compact onPress={logout} />}
      />

      {!isInstitution ? (
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'PROFILE', label: '나의 정보' },
            {
              value: 'RELATIONS',
              label: isWard ? '보호자 정보' : '피보호자 정보',
              count: relations.length,
            },
          ]}
        />
      ) : null}

      {error ? <Notice tone="error" title="정보를 처리하지 못했습니다.">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      {loading ? (
        <Section><LoadingState label="마이페이지 정보를 불러오고 있습니다." /></Section>
      ) : tab === 'PROFILE' || isInstitution ? (
        <View style={[styles.twoColumn, width < 980 && styles.oneColumn]}>
          <View style={styles.primaryColumn}>
            <Section
              title="계정 정보"
              description="아이디, 이메일과 역할은 현재 계정의 조회 정보입니다."
            >
              <View style={styles.infoGrid}>
                <InfoCard label="이름" value={profile?.username} />
                <InfoCard label="아이디" value={profile?.userId} />
                <InfoCard label="이메일" value={profile?.email} wide />
                <InfoCard label="역할" value={profile ? roleLabel(profile.userType) : undefined} />
              </View>
            </Section>

            <Section
              title="이름 변경"
              description="표시 이름만 변경할 수 있습니다. 저장 후 계정 정보에 바로 반영됩니다."
            >
              <Field
                label="새 이름"
                value={name}
                maxLength={50}
                onChangeText={setName}
                placeholder="변경할 이름을 입력하세요"
                returnKeyType="done"
                onSubmitEditing={saveName}
              />
              <View style={styles.actionRow}>
                <Button
                  title={saving ? '저장 중…' : '변경 내용 저장'}
                  disabled={saving || !name.trim() || name.trim() === profile?.username}
                  onPress={saveName}
                />
              </View>
            </Section>

            {isInstitution ? (
              <Section
                title="소속 기관"
                description="기관 계정에 연결된 소속 정보입니다."
              >
                <View style={styles.institutionCard}>
                  <View style={styles.institutionMark}><Text style={styles.institutionMarkText}>H</Text></View>
                  <View style={uiStyles.flex}>
                    <Text style={styles.institutionName}>
                      {profile?.institytionsName || '등록된 기관명이 없습니다.'}
                    </Text>
                    <Text style={uiStyles.muted}>기관 사용자에게만 표시되는 계정 정보</Text>
                  </View>
                  <StatusBadge label="기관 계정" tone="primary" />
                </View>
              </Section>
            ) : null}
          </View>

          <View style={styles.sideColumn}>
            <Section title="계정 안내">
              <GuideRow number="01" title="정보 보호" copy="계정별 권한에 따라 접근 가능한 정보가 구분됩니다." />
              <GuideRow number="02" title="문의가 필요할 때" copy="문의하기에서 등록 내역과 답변 상태를 확인할 수 있습니다." />
              <Button title="문의 등록·조회" tone="ghost" onPress={() => navigation.navigate('Inquiry')} />
            </Section>
          </View>
        </View>
      ) : (
        <Section
          title={isWard ? '연결된 보호자' : '연결된 피보호자'}
          description={
            isWard
              ? '메인 보호자는 체크 표시로 구분됩니다. 서버에서 전달된 관계 정보만 표시합니다.'
              : '승인되어 현재 연결된 피보호자 정보만 표시합니다.'
          }
        >
          {relations.length === 0 ? (
            <EmptyState
              title={isWard ? '연결된 보호자가 없습니다.' : '연결된 피보호자가 없습니다.'}
              action={<Button title="케어 연결로 이동" tone="ghost" onPress={() => navigation.navigate('Care')} />}
            >
              케어 연결 메뉴에서 연결 요청을 확인하거나 새 연결을 신청할 수 있습니다.
            </EmptyState>
          ) : (
            <View style={styles.relationGrid}>
              {relations.map((relation) => {
                const guardian = 'guardUserId' in relation;
                const relationName = guardian ? relation.guardUserName : relation.wardUserName;
                const relationId = guardian ? relation.guardUserId : relation.wardUserId;
                return (
                  <View key={relation.careId} style={styles.relationCard}>
                    <View style={styles.relationTop}>
                      <View style={styles.relationAvatar}>
                        <Text style={styles.relationAvatarText}>{relationName.slice(0, 1)}</Text>
                      </View>
                      <View style={uiStyles.flex}>
                        <View style={uiStyles.row}>
                          <Text style={styles.relationName}>{relationName}</Text>
                          {guardian && relation.mainGuardUser ? (
                            <StatusBadge label="✓ 메인 보호자" tone="success" />
                          ) : null}
                        </View>
                        <Text style={styles.relationId}>{relationId}</Text>
                      </View>
                    </View>
                    <View style={styles.relationActions}>
                      {guardian && !relation.mainGuardUser ? (
                        <Button
                          title="메인 보호자로 설정"
                          tone="ghost"
                          compact
                          disabled={saving}
                          onPress={() => chooseMainGuardian(relation)}
                        />
                      ) : null}
                      <Button
                        title="연결 해제"
                        tone="secondary"
                        compact
                        disabled={saving}
                        onPress={() => setPendingRemoval(relation)}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Section>
      )}

      <ConfirmDialog
        visible={Boolean(pendingRemoval)}
        title="케어 연결을 해제할까요?"
        description={`${selectedName}님과의 연결을 해제하면 해당 관계에 기반한 정보 접근이 중단됩니다.`}
        confirmLabel="연결 해제"
        destructive
        busy={saving}
        onCancel={() => setPendingRemoval(null)}
        onConfirm={removeRelation}
      />
    </Screen>
  );
}

function InfoCard({ label, value, wide }: { label: string; value?: string; wide?: boolean }) {
  return (
    <View style={[styles.infoCard, wide && styles.infoCardWide]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.infoValue}>{value || '-'}</Text>
    </View>
  );
}

function GuideRow({ number, title, copy }: { number: string; title: string; copy: string }) {
  return (
    <View style={styles.guideRow}>
      <Text style={styles.guideNumber}>{number}</Text>
      <View style={uiStyles.flex}>
        <Text style={styles.guideTitle}>{title}</Text>
        <Text style={styles.guideCopy}>{copy}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  twoColumn: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  oneColumn: { flexDirection: 'column' },
  primaryColumn: { flex: 1, width: '100%', gap: spacing.lg },
  sideColumn: { width: 330, maxWidth: '100%' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  infoCard: {
    flexGrow: 1,
    flexBasis: 190,
    minHeight: 98,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
    padding: spacing.md,
    justifyContent: 'center',
  },
  infoCardWide: { flexGrow: 2 },
  infoLabel: { color: colors.muted, fontFamily, fontSize: 10, fontWeight: '800' },
  infoValue: { color: colors.text, fontFamily, fontSize: 15, fontWeight: '900', marginTop: 9 },
  actionRow: { alignSelf: 'flex-start', minWidth: 180 },
  institutionCard: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
  },
  institutionMark: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  institutionMarkText: { color: '#fff', fontFamily, fontSize: 17, fontWeight: '900' },
  institutionName: { color: colors.text, fontFamily, fontSize: 15, fontWeight: '900', marginBottom: 4 },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  guideNumber: { color: colors.primary, fontFamily, fontSize: 10, fontWeight: '900' },
  guideTitle: { color: colors.text, fontFamily, fontSize: 12, fontWeight: '900' },
  guideCopy: { color: colors.muted, fontFamily, fontSize: 10, lineHeight: 17, marginTop: 4 },
  relationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  relationCard: {
    flexGrow: 1,
    flexBasis: 320,
    maxWidth: 560,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 20,
  },
  relationTop: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  relationAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  relationAvatarText: { color: colors.primary, fontFamily, fontSize: 16, fontWeight: '900' },
  relationName: { color: colors.text, fontFamily, fontSize: 16, fontWeight: '900' },
  relationId: { color: colors.muted, fontFamily, fontSize: 11, marginTop: 6 },
  relationActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
