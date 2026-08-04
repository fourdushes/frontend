import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { readableError } from '../api/client';
import { institutionAccountApi } from '../api/institutionAccountApi';
import { teamApi } from '../api/teamApi';
import { Button, Field, Notice, Screen, StatusBadge } from '../components/Ui';
import { RootStackParamList, SignupGroup } from '../navigation';
import { colors, fontFamily, radius, spacing } from '../theme/theme';
import { InstitutionSearchItem, UserType } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

export function SignupScreen({ navigation, route }: Props) {
  const { width } = useWindowDimensions();
  const stacked = width < 840;
  const [group, setGroup] = useState<SignupGroup | null>(route.params?.group ?? null);
  const [userType, setUserType] = useState<UserType>('WARD');
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [code, setCode] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [institutionKeyword, setInstitutionKeyword] = useState('');
  const [institutionResults, setInstitutionResults] = useState<InstitutionSearchItem[]>([]);
  const [selectedInstitution, setSelectedInstitution] = useState<InstitutionSearchItem | null>(null);
  const [activeResult, setActiveResult] = useState(0);
  const [institutionLoading, setInstitutionLoading] = useState(false);
  const [institutionError, setInstitutionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const searchSequence = useRef(0);

  const normalizedEmail = email.trim().toLowerCase();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const passwordMatches = password.length > 0 && password === passwordConfirm;

  useEffect(() => {
    if (!emailSent || emailVerified || secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [emailSent, emailVerified, secondsLeft]);

  useEffect(() => {
    const keyword = institutionKeyword.trim();
    if (group !== 'USER' || userType !== 'INSTITUTIONS' || selectedInstitution?.institutionName === keyword) return;
    if (!keyword) {
      setInstitutionResults([]);
      setInstitutionError(null);
      return;
    }

    const sequence = ++searchSequence.current;
    const timer = setTimeout(async () => {
      setInstitutionLoading(true);
      setInstitutionError(null);
      try {
        const page = await teamApi.searchInstitutionsForSignup(keyword);
        if (sequence === searchSequence.current) {
          setInstitutionResults(page.content ?? []);
          setActiveResult(0);
        }
      } catch (caught) {
        if (sequence === searchSequence.current) setInstitutionError(readableError(caught));
      } finally {
        if (sequence === searchSequence.current) setInstitutionLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [group, institutionKeyword, selectedInstitution, userType]);

  function chooseGroup(next: SignupGroup) {
    setGroup(next);
    setUserType('WARD');
    setSelectedInstitution(null);
    setInstitutionKeyword('');
    setInstitutionResults([]);
    setError(null);
    setCreated(false);
  }

  function changeEmail(value: string) {
    setEmail(value);
    setEmailSent(false);
    setEmailVerified(false);
    setCode('');
    setSecondsLeft(0);
    setMessage(null);
  }

  async function sendCode() {
    if (!validEmail || loading) return;
    setLoading(true);
    setError(null);
    try {
      if (group === 'INSTITUTION') await institutionAccountApi.sendVerificationCode(normalizedEmail);
      else await teamApi.sendEmailCode(normalizedEmail);
      setEmailSent(true);
      setSecondsLeft(180);
      setMessage('인증번호를 보냈습니다. 메일함과 스팸함을 확인해 주세요.');
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    if (code.length !== 6 || loading) return;
    setLoading(true);
    setError(null);
    try {
      if (group === 'INSTITUTION') await institutionAccountApi.verifyVerificationCode(normalizedEmail, code);
      else await teamApi.checkEmailCode(normalizedEmail, code);
      setEmailVerified(true);
      setSecondsLeft(0);
      setMessage('이메일 인증이 완료되었습니다.');
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!group || !passwordMatches || loading) return;
    if (!emailVerified || (group === 'USER' && userType === 'INSTITUTIONS' && !selectedInstitution)) return;
    setLoading(true);
    setError(null);
    try {
      if (group === 'INSTITUTION') {
        await institutionAccountApi.join({
          institutionName: name.trim(),
          email: normalizedEmail,
          institutionId: id.trim(),
          password,
          checkPassword: passwordConfirm,
        });
      } else {
        await teamApi.join(
          {
            id: id.trim(),
            name: name.trim(),
            email: normalizedEmail,
            password,
            userType,
          },
          selectedInstitution?.institutionId,
        );
      }
      setCreated(true);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setLoading(false);
    }
  }

  function chooseInstitution(item: InstitutionSearchItem) {
    setSelectedInstitution(item);
    setInstitutionKeyword(item.institutionName);
    setInstitutionResults([]);
    setInstitutionError(null);
  }

  function handleInstitutionKey(key: string) {
    if (!institutionResults.length) return;
    if (key === 'ArrowDown') {
      setActiveResult((value) => Math.min(institutionResults.length - 1, value + 1));
    } else if (key === 'ArrowUp') {
      setActiveResult((value) => Math.max(0, value - 1));
    } else if (key === 'Enter') {
      chooseInstitution(institutionResults[activeResult]);
    } else if (key === 'Escape') {
      setInstitutionResults([]);
    }
  }

  if (!group) {
    return (
      <Screen contentStyle={styles.choiceScreen}>
        <View style={styles.choiceIntro}>
          <Text style={styles.choiceEyebrow}>CHOOSE YOUR HEARO</Text>
          <Text style={styles.choiceTitle}>어떤 방식으로 함께할까요?</Text>
          <Text style={styles.choiceDescription}>
            사용자는 세 가지 역할 중 하나를 선택하고, 기관은 별도의 기관 계정으로 가입합니다.
          </Text>
        </View>
        <View style={[styles.choiceGrid, stacked && styles.choiceGridStacked]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => chooseGroup('USER')}
            style={({ pressed }) => [styles.choiceCard, pressed && styles.choiceCardPressed]}
          >
            <View style={styles.choiceNumber}><Text style={styles.choiceNumberText}>01</Text></View>
            <View style={styles.choiceSymbol}><Text style={styles.choiceSymbolText}>♡</Text></View>
            <Text style={styles.cardEyebrow}>FOR PATIENT & FAMILY</Text>
            <Text style={styles.cardTitle}>사용자 회원가입</Text>
            <Text style={styles.cardDescription}>피보호자 사용자, 보호자 사용자, 기관 사용자 중 하나를 선택합니다.</Text>
            <Text style={styles.cardAction}>사용자로 시작하기  →</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => chooseGroup('INSTITUTION')}
            style={({ pressed }) => [
              styles.choiceCard,
              styles.choiceCardInstitution,
              pressed && styles.choiceCardPressed,
            ]}
          >
            <View style={styles.choiceNumber}><Text style={styles.choiceNumberText}>02</Text></View>
            <View style={[styles.choiceSymbol, styles.choiceSymbolDark]}><Text style={styles.choiceSymbolTextDark}>＋</Text></View>
            <Text style={styles.cardEyebrow}>FOR MEDICAL TEAM</Text>
            <Text style={styles.cardTitle}>기관 회원가입</Text>
            <Text style={styles.cardDescription}>기관 사용자와 구분되는 기관 자체 계정을 등록합니다.</Text>
            <Text style={styles.cardAction}>기관 계정 만들기  →</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => navigation.navigate('Login')} style={styles.loginAction}>
          <Text style={styles.loginLink}>이미 계정이 있으신가요? <Text style={styles.loginLinkStrong}>로그인</Text></Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.formScreen}>
      <View style={styles.formTopbar}>
        <Pressable accessibilityLabel="가입 유형 선택으로 돌아가기" onPress={() => setGroup(null)}>
          <Text style={styles.backLink}>← 가입 유형 다시 선택</Text>
        </Pressable>
        <StatusBadge
          label={group === 'INSTITUTION' ? '기관 계정' : '사용자 계정'}
          tone="primary"
        />
      </View>

      <View style={[styles.formLayout, stacked && styles.formLayoutStacked]}>
        <View style={[styles.stepRail, stacked && styles.stepRailStacked]}>
          <Text style={styles.stepEyebrow}>JOIN HEARO</Text>
          <Text style={styles.stepTitle}>
            {group === 'INSTITUTION' ? '기관 회원가입' : '사용자 회원가입'}
          </Text>
          <Text style={styles.stepDescription}>
            {group === 'INSTITUTION'
              ? '기관 사용자와 구분되는 기관 자체 정보를 등록합니다.'
              : '세 사용자 역할 중 하나를 선택하고 계정 정보를 입력합니다.'}
          </Text>
          <View style={styles.steps}>
            {(group === 'INSTITUTION'
              ? [
                  ['1', '기관 정보'],
                  ['2', '이메일 인증'],
                  ['3', '로그인 정보'],
                ]
              : [
                  ['1', '사용자 역할'],
                  ['2', '이메일 인증'],
                  ['3', '계정 정보'],
                ]
            ).map(([number, label]) => (
              <View key={number} style={styles.stepItem}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{number}</Text></View>
                <Text style={styles.stepLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.formCard, stacked && styles.formCardStacked]}>
          {created ? (
            <View style={styles.successState}>
              <View style={styles.successIcon}><Text style={styles.successIconText}>✓</Text></View>
              <Text style={styles.successTitle}>가입이 완료되었습니다.</Text>
              <Text style={styles.successText}>{group === 'INSTITUTION' ? '관리자 승인 후 기관 계정으로 로그인할 수 있습니다.' : '새 계정으로 로그인해 HearO 서비스를 시작하세요.'}</Text>
              <View style={styles.successAction}>
                <Button title="로그인으로 이동" onPress={() => navigation.navigate('Login', group === 'INSTITUTION' ? { kind: 'INSTITUTION' } : undefined)} />
              </View>
            </View>
          ) : (
            <>
              <View style={[styles.formCardIntro, stacked && styles.formCardIntroStacked]}>
                <View style={styles.formCardIntroCopy}>
                  <Text style={styles.formCardEyebrow}>ACCOUNT SETUP</Text>
                  <Text style={styles.formCardTitle}>가입 정보를 입력해 주세요.</Text>
                  <Text style={styles.formCardDescription}>
                    필요한 정보만 간단히 확인하면 바로 HearO를 시작할 수 있습니다.
                  </Text>
                </View>
                <View style={styles.durationBadge}>
                  <Text style={styles.durationBadgeText}>약 3분</Text>
                </View>
              </View>

              <View style={[styles.formSection, styles.formSectionCard]}>
                <SignupSectionHeader
                  step="01"
                  title={group === 'INSTITUTION' ? '기관 정보' : '사용자 역할'}
                  description={
                    group === 'INSTITUTION'
                      ? '서비스에서 사용할 기관명을 입력해 주세요.'
                      : 'HearO에서 이용할 역할 하나를 선택해 주세요.'
                  }
                />
                {group === 'USER' ? (
                  <>
                    <View style={[styles.roleGrid, stacked && styles.roleGridStacked]}>
                      <Pressable
                        onPress={() => setUserType('WARD')}
                        style={[
                          styles.roleCard,
                          stacked && styles.roleCardStacked,
                          userType === 'WARD' && styles.roleCardActive,
                        ]}
                      >
                        <View style={styles.roleCardTop}>
                          <View style={[styles.roleIcon, userType === 'WARD' && styles.roleIconActive]}>
                            <Text style={[styles.roleIconText, userType === 'WARD' && styles.roleIconTextActive]}>＋</Text>
                          </View>
                          <View style={[styles.roleCheck, userType === 'WARD' && styles.roleCheckActive]}>
                            <Text style={styles.roleCheckText}>{userType === 'WARD' ? '✓' : ''}</Text>
                          </View>
                        </View>
                        <Text style={[styles.roleTitle, userType === 'WARD' && styles.roleTitleActive]}>피보호자 사용자</Text>
                        <Text style={styles.roleText}>진료를 요청하고 내 기록을 확인합니다.</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setUserType('GUARDIAN')}
                        style={[
                          styles.roleCard,
                          stacked && styles.roleCardStacked,
                          userType === 'GUARDIAN' && styles.roleCardActive,
                        ]}
                      >
                        <View style={styles.roleCardTop}>
                          <View style={[styles.roleIcon, userType === 'GUARDIAN' && styles.roleIconActive]}>
                            <Text style={[styles.roleIconText, userType === 'GUARDIAN' && styles.roleIconTextActive]}>♡</Text>
                          </View>
                          <View style={[styles.roleCheck, userType === 'GUARDIAN' && styles.roleCheckActive]}>
                            <Text style={styles.roleCheckText}>{userType === 'GUARDIAN' ? '✓' : ''}</Text>
                          </View>
                        </View>
                        <Text style={[styles.roleTitle, userType === 'GUARDIAN' && styles.roleTitleActive]}>보호자 사용자</Text>
                        <Text style={styles.roleText}>연결된 가족의 진료 기록을 확인합니다.</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setUserType('INSTITUTIONS')}
                        style={[
                          styles.roleCard,
                          stacked && styles.roleCardStacked,
                          userType === 'INSTITUTIONS' && styles.roleCardActive,
                        ]}
                      >
                        <View style={styles.roleCardTop}>
                          <View style={[styles.roleIcon, userType === 'INSTITUTIONS' && styles.roleIconActive]}>
                            <Text style={[styles.roleIconText, userType === 'INSTITUTIONS' && styles.roleIconTextActive]}>H</Text>
                          </View>
                          <View style={[styles.roleCheck, userType === 'INSTITUTIONS' && styles.roleCheckActive]}>
                            <Text style={styles.roleCheckText}>{userType === 'INSTITUTIONS' ? '✓' : ''}</Text>
                          </View>
                        </View>
                        <Text style={[styles.roleTitle, userType === 'INSTITUTIONS' && styles.roleTitleActive]}>기관 사용자</Text>
                        <Text style={styles.roleText}>소속 기관을 선택하고 진료 업무를 담당합니다.</Text>
                      </Pressable>
                    </View>
                    {userType === 'INSTITUTIONS' ? (
                      <View style={styles.institutionSearch}>
                        <Field
                          label="소속 기관 검색"
                          value={institutionKeyword}
                          onChangeText={(value) => {
                            setInstitutionKeyword(value);
                            setSelectedInstitution(null);
                          }}
                          onKeyPress={(event) => handleInstitutionKey(event.nativeEvent.key)}
                          placeholder="병원 또는 의료기관 이름"
                          hint="입력을 멈추면 0.3초 후 검색"
                        />
                        {selectedInstitution ? (
                          <Notice tone="success" title="소속 기관 선택 완료">
                            {selectedInstitution.institutionName}
                          </Notice>
                        ) : null}
                        {institutionKeyword.trim() && !selectedInstitution ? (
                          <View accessibilityRole="menu" style={styles.searchDropdown}>
                            <View style={styles.searchDropdownHeader}>
                              <Text style={styles.searchDropdownTitle}>검색된 기관</Text>
                              <StatusBadge label={`${institutionResults.length}곳`} tone="primary" />
                            </View>
                            {institutionLoading ? (
                              <View style={styles.searchDropdownState}>
                                <Text style={styles.searchDropdownStateIcon}>…</Text>
                                <View style={styles.searchDropdownStateCopy}>
                                  <Text style={styles.searchDropdownStateTitle}>등록 기관을 검색하고 있습니다.</Text>
                                  <Text style={styles.searchDropdownStateText}>잠시만 기다려 주세요.</Text>
                                </View>
                              </View>
                            ) : null}
                            {!institutionLoading && institutionError ? (
                              <View style={styles.searchDropdownState}>
                                <Text style={styles.searchDropdownStateIcon}>!</Text>
                                <View style={styles.searchDropdownStateCopy}>
                                  <Text style={styles.searchDropdownStateTitle}>기관을 검색하지 못했습니다.</Text>
                                  <Text style={styles.searchDropdownStateText}>{institutionError}</Text>
                                </View>
                              </View>
                            ) : null}
                            {!institutionLoading && !institutionError && !institutionResults.length ? (
                              <View style={styles.searchDropdownState}>
                                <Text style={styles.searchDropdownStateIcon}>?</Text>
                                <View style={styles.searchDropdownStateCopy}>
                                  <Text style={styles.searchDropdownStateTitle}>검색 결과가 없습니다.</Text>
                                  <Text style={styles.searchDropdownStateText}>등록된 기관명을 다시 확인해 주세요.</Text>
                                </View>
                              </View>
                            ) : null}
                            {!institutionLoading && !institutionError ? institutionResults.map((item, index) => (
                              <Pressable
                                key={item.institutionId}
                                accessibilityRole="menuitem"
                                onPress={() => chooseInstitution(item)}
                                style={[styles.searchResult, index === activeResult && styles.searchResultActive]}
                              >
                                <View style={styles.searchResultMark}><Text style={styles.searchResultMarkText}>H</Text></View>
                                <Text style={styles.searchResultName}>{item.institutionName}</Text>
                                <Text style={styles.searchResultAction}>선택</Text>
                              </Pressable>
                            )) : null}
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </>
                ) : (
                  <Field
                    label="기관명"
                    value={name}
                    onChangeText={setName}
                    placeholder="등록할 기관명을 입력하세요."
                  />
                )}
              </View>

              <View style={[styles.formSection, styles.formSectionCard]}>
                    <SignupSectionHeader
                      step="02"
                      title="이메일 인증"
                      description="계정 보호를 위해 실제 사용하는 이메일을 확인합니다."
                    />
                    <View style={[styles.emailRow, stacked && styles.emailRowStacked]}>
                      <View style={styles.emailField}>
                        <Field
                          label="이메일"
                          value={email}
                          onChangeText={changeEmail}
                          editable={!emailVerified}
                          keyboardType="email-address"
                          placeholder="name@example.com"
                          error={email.length > 3 && !validEmail ? '올바른 이메일 형식을 입력해 주세요.' : undefined}
                        />
                      </View>
                      <View style={[styles.emailAction, stacked && styles.emailActionStacked]}>
                        <Button
                          title={emailSent ? '다시 받기' : '인증번호 받기'}
                          tone={emailSent ? 'secondary' : 'primary'}
                          onPress={sendCode}
                          disabled={loading || !validEmail || emailVerified}
                        />
                      </View>
                    </View>
                    {emailSent && !emailVerified ? (
                      <View style={[styles.codeRow, stacked && styles.codeRowStacked]}>
                        <View style={styles.codeField}>
                          <Field
                            label="인증번호"
                            value={code}
                            onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                            keyboardType="number-pad"
                            maxLength={6}
                            placeholder="6자리 숫자"
                            hint={secondsLeft > 0 ? formatTime(secondsLeft) : '인증번호 만료'}
                          />
                        </View>
                        <View style={[styles.codeButton, stacked && styles.codeButtonStacked]}>
                          <Button
                            title="번호 확인"
                            onPress={verifyCode}
                            disabled={loading || code.length !== 6 || secondsLeft <= 0}
                          />
                        </View>
                      </View>
                    ) : null}
                    {message ? <Notice tone={emailVerified ? 'success' : 'info'}>{message}</Notice> : null}
                </View>

              <View style={[styles.formSection, styles.formSectionCard]}>
                <SignupSectionHeader
                  step="03"
                  title="계정 정보"
                  description={
                    group === 'INSTITUTION'
                      ? '기관 로그인에 사용할 아이디와 비밀번호를 설정해 주세요.'
                      : '로그인에 사용할 기본 정보를 설정해 주세요.'
                  }
                />
                <View style={[styles.twoColumns, stacked && styles.twoColumnsStacked]}>
                  <View style={styles.column}>
                    <Field
                      label={group === 'INSTITUTION' ? '기관 로그인 아이디' : '아이디'}
                      value={id}
                      onChangeText={setId}
                      placeholder="5자 이상"
                      error={id.length > 0 && id.trim().length < 5 ? '아이디는 5자 이상이어야 합니다.' : undefined}
                    />
                  </View>
                  {group === 'USER' ? (
                    <View style={styles.column}>
                      <Field
                        label="이름"
                        value={name}
                        onChangeText={setName}
                        placeholder="이름 입력"
                      />
                    </View>
                  ) : null}
                </View>
                <View style={[styles.twoColumns, stacked && styles.twoColumnsStacked]}>
                  <View style={styles.column}>
                    <Field
                      label="비밀번호"
                      value={password}
                      onChangeText={setPassword}
                      placeholder="비밀번호 입력"
                      secureTextEntry
                    />
                  </View>
                  <View style={styles.column}>
                    <Field
                      label="비밀번호 확인"
                      value={passwordConfirm}
                      onChangeText={setPasswordConfirm}
                      placeholder="다시 입력"
                      secureTextEntry
                      error={passwordConfirm && !passwordMatches ? '비밀번호가 일치하지 않습니다.' : undefined}
                    />
                  </View>
                </View>
                {error ? <Notice tone="error" title="가입을 완료하지 못했습니다.">{error}</Notice> : null}
                <View style={styles.submitPanel}>
                  <Text style={styles.submitHint}>입력한 정보를 확인한 뒤 가입을 완료해 주세요.</Text>
                  <Button
                    title={loading ? '가입 정보를 확인하고 있습니다…' : group === 'INSTITUTION' ? '기관 계정 만들기' : '사용자 계정 만들기'}
                    onPress={submit}
                    disabled={
                      loading ||
                      !emailVerified ||
                      id.trim().length < 5 ||
                      !name.trim() ||
                      !passwordMatches ||
                      (group === 'USER' && userType === 'INSTITUTIONS' && !selectedInstitution)
                    }
                  />
                </View>
              </View>
            </>
          )}
        </View>
      </View>
    </Screen>
  );
}

function SignupSectionHeader({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.formSectionHeader}>
      <View style={styles.formSectionStep}>
        <Text style={styles.formSectionStepText}>{step}</Text>
      </View>
      <View style={styles.formSectionHeaderCopy}>
        <Text style={styles.formSectionTitle}>{title}</Text>
        <Text style={styles.formSectionDescription}>{description}</Text>
      </View>
    </View>
  );
}

function formatTime(totalSeconds: number) {
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  choiceScreen: { maxWidth: 1160, paddingTop: 16 },
  loginAction: { alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 18, marginTop: 14 },
  loginLink: { color: colors.muted, fontFamily, fontSize: 11 },
  loginLinkStrong: { color: colors.primary, fontWeight: '900' },
  choiceIntro: { alignItems: 'center', paddingTop: 46, paddingBottom: 36 },
  choiceEyebrow: { color: colors.primary, fontFamily, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  choiceTitle: { color: colors.text, fontFamily, fontSize: 34, fontWeight: '900', letterSpacing: -1, marginTop: 11, textAlign: 'center' },
  choiceDescription: { maxWidth: 620, color: colors.muted, fontFamily, fontSize: 12, lineHeight: 20, marginTop: 11, textAlign: 'center' },
  choiceGrid: { flexDirection: 'row', gap: 18 },
  choiceGridStacked: { flexDirection: 'column' },
  choiceCard: {
    flex: 1,
    minHeight: 370,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 30,
  },
  choiceCardInstitution: { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder },
  choiceCardPressed: { transform: [{ scale: 0.995 }], borderColor: colors.primary },
  choiceNumber: { alignSelf: 'flex-end' },
  choiceNumberText: { color: colors.faint, fontFamily, fontSize: 10, fontWeight: '900' },
  choiceSymbol: { width: 62, height: 62, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 35 },
  choiceSymbolDark: { backgroundColor: colors.ink },
  choiceSymbolText: { color: colors.primary, fontFamily, fontSize: 28, fontWeight: '600' },
  choiceSymbolTextDark: { color: '#fff', fontFamily, fontSize: 26, fontWeight: '600' },
  cardEyebrow: { color: colors.primary, fontFamily, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginTop: 28 },
  cardTitle: { color: colors.text, fontFamily, fontSize: 24, fontWeight: '900', letterSpacing: -0.6, marginTop: 8 },
  cardDescription: { color: colors.muted, fontFamily, fontSize: 12, lineHeight: 20, maxWidth: 440, marginTop: 11 },
  cardAction: { color: colors.primary, fontFamily, fontSize: 12, fontWeight: '900', marginTop: 'auto' },
  formScreen: { maxWidth: 1280 },
  formTopbar: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backLink: { color: colors.primary, fontFamily, fontSize: 11, fontWeight: '800' },
  formLayout: {
    minHeight: 720,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    flexDirection: 'row',
    marginTop: 10,
  },
  formLayoutStacked: { flexDirection: 'column' },
  stepRail: { width: 300, padding: 34, backgroundColor: colors.ink },
  stepRailStacked: { width: '100%' },
  stepEyebrow: { color: '#d8f3ec', fontFamily, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  stepTitle: { color: '#fff', fontFamily, fontSize: 24, fontWeight: '900', marginTop: 11 },
  stepDescription: { color: '#e0f0ec', fontFamily, fontSize: 11, lineHeight: 19, marginTop: 9 },
  steps: { marginTop: 42, gap: 20 },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNumber: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)', alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: '#fff', fontFamily, fontSize: 10, fontWeight: '900' },
  stepLabel: { color: '#fff', fontFamily, fontSize: 11, fontWeight: '800' },
  formCard: { flex: 1, padding: 34, gap: 18, backgroundColor: colors.surface },
  formCardStacked: { padding: 22 },
  formCardIntro: { minHeight: 88, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, paddingHorizontal: 2 },
  formCardIntroStacked: { flexDirection: 'column', minHeight: 0 },
  formCardIntroCopy: { flex: 1, minWidth: 0 },
  formCardEyebrow: { color: colors.primary, fontFamily, fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  formCardTitle: { color: colors.text, fontFamily, fontSize: 24, fontWeight: '900', letterSpacing: -0.7, marginTop: 7 },
  formCardDescription: { color: colors.muted, fontFamily, fontSize: 10, lineHeight: 17, marginTop: 6 },
  durationBadge: { minHeight: 32, borderRadius: radius.pill, backgroundColor: colors.primarySoft, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  durationBadgeText: { color: colors.primary, fontFamily, fontSize: 9, fontWeight: '900' },
  formSection: { gap: 16 },
  formSectionCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.canvas, padding: 20 },
  formSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  formSectionStep: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  formSectionStepText: { color: '#fff', fontFamily, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  formSectionHeaderCopy: { flex: 1, minWidth: 0 },
  formSectionTitle: { color: colors.text, fontFamily, fontSize: 15, fontWeight: '900' },
  formSectionDescription: { color: colors.muted, fontFamily, fontSize: 9, lineHeight: 15, marginTop: 3 },
  roleGrid: { flexDirection: 'row', gap: 10 },
  roleGridStacked: { flexDirection: 'column' },
  roleCard: { flex: 1, minHeight: 132, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, padding: 14 },
  roleCardStacked: { width: '100%', flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  roleCardActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  roleCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  roleIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  roleIconActive: { backgroundColor: colors.primary },
  roleIconText: { color: colors.primary, fontFamily, fontSize: 14, fontWeight: '900' },
  roleIconTextActive: { color: '#fff' },
  roleCheck: { width: 20, height: 20, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  roleCheckActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  roleCheckText: { color: '#fff', fontFamily, fontSize: 9, fontWeight: '900' },
  roleTitle: { color: colors.text, fontFamily, fontSize: 11, fontWeight: '900' },
  roleTitleActive: { color: colors.primary },
  roleText: { color: colors.muted, fontFamily, fontSize: 8, lineHeight: 14, marginTop: 5 },
  institutionSearch: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16, gap: 10 },
  searchDropdown: { borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' },
  searchDropdownHeader: { minHeight: 42, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.canvas, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  searchDropdownTitle: { color: colors.text, fontFamily, fontSize: 10, fontWeight: '900' },
  searchDropdownState: { minHeight: 72, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  searchDropdownStateIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.surfaceSoft, color: colors.primary, fontFamily, fontSize: 12, fontWeight: '900', textAlign: 'center', lineHeight: 30 },
  searchDropdownStateCopy: { flex: 1, minWidth: 0 },
  searchDropdownStateTitle: { color: colors.text, fontFamily, fontSize: 10, fontWeight: '900' },
  searchDropdownStateText: { color: colors.muted, fontFamily, fontSize: 8, lineHeight: 14, marginTop: 3 },
  searchResult: { minHeight: 54, paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchResultActive: { backgroundColor: colors.primarySoft },
  searchResultMark: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  searchResultMarkText: { color: colors.primary, fontFamily, fontSize: 11, fontWeight: '900' },
  searchResultName: { flex: 1, color: colors.text, fontFamily, fontSize: 11, fontWeight: '800' },
  searchResultAction: { color: colors.primary, fontFamily, fontSize: 9, fontWeight: '900' },
  emailRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  emailRowStacked: { flexDirection: 'column', alignItems: 'stretch' },
  emailField: { flex: 1, minWidth: 0 },
  emailAction: { width: 142 },
  emailActionStacked: { width: '100%' },
  codeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  codeRowStacked: { flexDirection: 'column', alignItems: 'stretch' },
  codeField: { flex: 1 },
  codeButton: { width: 118 },
  codeButtonStacked: { width: '100%' },
  twoColumns: { flexDirection: 'column', gap: 14 },
  twoColumnsStacked: { flexDirection: 'column' },
  column: { width: '100%' },
  submitPanel: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 17, gap: 11 },
  submitHint: { color: colors.muted, fontFamily, fontSize: 9, textAlign: 'center' },
  successState: { flex: 1, minHeight: 520, alignItems: 'center', justifyContent: 'center' },
  successIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' },
  successIconText: { color: colors.success, fontFamily, fontSize: 26, fontWeight: '900' },
  successTitle: { color: colors.text, fontFamily, fontSize: 24, fontWeight: '900', marginTop: 22 },
  successText: { color: colors.muted, fontFamily, fontSize: 12, marginTop: 8, textAlign: 'center' },
  successAction: { minWidth: 220, marginTop: 26 },
});
