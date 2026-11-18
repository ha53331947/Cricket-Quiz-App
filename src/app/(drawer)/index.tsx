import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../supabase'; // Apne project ke mutabiq path check kar lein
import { useTheme } from '../../context/ThemeContext';

type Question = {
  id: number;
  question: string;
  options: string[];
  correct_answer: string;
  user_answer?: string | null;
};

const LEVELS = [
  { key: 'easy', title: 'Easy', emoji: '🟢', count: 10, desc: 'Simple questions to get you started' },
  { key: 'medium', title: 'Medium', emoji: '🟡', count: 20, desc: 'A tougher challenge from classic and modern eras' },
  { key: 'hard', title: 'Hard', emoji: '🔴', count: 50, desc: 'The ultimate test for true cricket experts' },
];

const LIMITS: Record<string, number> = { easy: 10, medium: 20, hard: 50 };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function QuizIndexScreen() {
  const router = useRouter();
  const { resumeAttemptId } = useLocalSearchParams<{ resumeAttemptId?: string }>();
  const { colors, isDarkMode } = useTheme();
  const cardBg = isDarkMode ? '#111827' : '#ffffff';
  const btnText = isDarkMode ? '#090d16' : '#ffffff';

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const attemptIdRef = useRef<string | null>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  // Latest state ref for AppState background save
  const latestStateRef = useRef({
    selectedLevel: null as string | null,
    questions: [] as Question[],
    index: 0,
    score: 0,
    finished: false,
  });

  useEffect(() => {
    latestStateRef.current = { selectedLevel, questions, index, score, finished };
  }, [selectedLevel, questions, index, score, finished]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const uid = data.session?.user?.id ?? null;
      userIdRef.current = uid;
      setUserId(uid);
      setUserEmail(data.session?.user?.email ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const uid = session?.user?.id ?? null;
      userIdRef.current = uid;
      setUserId(uid);
      setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const persistProgress = useCallback(
    async (params: {
      level: string;
      status: 'in_progress' | 'completed';
      score: number;
      totalQuestions: number;
      currentIndex: number;
      questionsState: Question[];
    }) => {
      const uid = userIdRef.current;
      if (!uid) return null;

      const currentAttemptId = attemptIdRef.current;

      if (currentAttemptId) {
        await supabase
          .from('quiz_history')
          .update({
            status: params.status,
            score: params.score,
            total_questions: params.totalQuestions,
            current_index: params.currentIndex,
            questions_state: params.questionsState,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentAttemptId)
          .eq('user_id', uid);
        return currentAttemptId;
      } else {
        const { data } = await supabase
          .from('quiz_history')
          .insert({
            user_id: uid,
            level: params.level,
            status: params.status,
            score: params.score,
            total_questions: params.totalQuestions,
            current_index: params.currentIndex,
            questions_state: params.questionsState,
          })
          .select('id')
          .single();

        if (data?.id) {
          attemptIdRef.current = data.id;
          setAttemptId(data.id);
          return data.id as string;
        }
        return null;
      }
    },
    []
  );

  // Save immediately if user backgrounds/closes app mid-quiz
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        const snap = latestStateRef.current;
        if (snap.selectedLevel && snap.questions.length > 0 && !snap.finished && userIdRef.current) {
          persistProgress({
            level: snap.selectedLevel,
            status: 'in_progress',
            score: snap.score,
            totalQuestions: snap.questions.length,
            currentIndex: snap.index,
            questionsState: snap.questions,
          });
        }
      }
    });
    return () => sub.remove();
  }, [persistProgress]);

  // Resume unfinished quiz when coming from score-history screen
  useEffect(() => {
    if (!resumeAttemptId || !userId) return;

    let active = true;

    (async () => {
      setSelectedLevel('loading');
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('quiz_history')
        .select('*')
        .eq('id', resumeAttemptId)
        .eq('user_id', userId)
        .single();

      if (!active) return;

      if (err || !data) {
        setSelectedLevel(null);
        setError(err?.message || 'Unable to load saved quiz.');
        setLoading(false);
        router.setParams({ resumeAttemptId: undefined });
        return;
      }

      const savedQuestions: Question[] = data.questions_state ?? [];
      const safeIndex = Math.min(
        data.current_index ?? 0,
        Math.max(savedQuestions.length - 1, 0)
      );

      attemptIdRef.current = data.id;
      setAttemptId(data.id);
      setSelectedLevel(data.level);
      setQuestions(savedQuestions);
      setIndex(safeIndex);
      setScore(data.score ?? 0);
      setSelected(savedQuestions[safeIndex]?.user_answer ?? null);
      setFinished(data.status === 'completed');
      setLoading(false);
      router.setParams({ resumeAttemptId: undefined });
    })();

    return () => {
      active = false;
    };
  }, [resumeAttemptId, userId, router]);

  const loadQuestions = useCallback(
    async (level: string) => {
      setLoading(true);
      setError(null);
      attemptIdRef.current = null;
      setAttemptId(null);
      setIndex(0);
      setSelected(null);
      setScore(0);
      setFinished(false);

      const { data, error: err } = await supabase.rpc('get_quiz_questions', {
        p_level: level,
        p_limit: LIMITS[level] ?? 10,
      });

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setError('No questions found for this level.');
        setLoading(false);
        return;
      }

      const prepared: Question[] = shuffle(data as Question[]).map((q) => ({
        ...q,
        options: shuffle(q.options),
        user_answer: null,
      }));

      setQuestions(prepared);

      await persistProgress({
        level,
        status: 'in_progress',
        score: 0,
        totalQuestions: prepared.length,
        currentIndex: 0,
        questionsState: prepared,
      });

      setLoading(false);
    },
    [persistProgress]
  );

  const handleSelectLevel = (level: string) => {
    setSelectedLevel(level);
    loadQuestions(level);
  };

  const current = questions[index];

  const onSelect = async (option: string) => {
    if (selected || !current || !selectedLevel) return;

    setSelected(option);
    const isCorrect = option === current.correct_answer;
    const nextScore = isCorrect ? score + 1 : score;

    if (isCorrect) {
      setScore(nextScore);
    }

    const updatedQuestions = questions.map((q, idx) =>
      idx === index ? { ...q, user_answer: option } : q
    );
    setQuestions(updatedQuestions);

    await persistProgress({
      level: selectedLevel,
      status: 'in_progress',
      score: nextScore,
      totalQuestions: updatedQuestions.length,
      currentIndex: index,
      questionsState: updatedQuestions,
    });
  };

  const onNext = async () => {
    if (!selectedLevel) return;

    if (index + 1 >= questions.length) {
      setFinished(true);
      await persistProgress({
        level: selectedLevel,
        status: 'completed',
        score,
        totalQuestions: questions.length,
        currentIndex: index,
        questionsState: questions,
      });
    } else {
      const nextIdx = index + 1;
      setIndex(nextIdx);
      setSelected(questions[nextIdx]?.user_answer ?? null);

      await persistProgress({
        level: selectedLevel,
        status: 'in_progress',
        score,
        totalQuestions: questions.length,
        currentIndex: nextIdx,
        questionsState: questions,
      });
    }
  };

  const optionStyle = (option: string) => {
    if (!selected) return { backgroundColor: cardBg, borderColor: colors.border };
    if (current && option === current.correct_answer)
      return { backgroundColor: '#14532d', borderColor: '#22c55e' };
    if (option === selected) return { backgroundColor: '#7f1d1d', borderColor: '#ef4444' };
    return { backgroundColor: cardBg, borderColor: colors.border, opacity: 0.5 };
  };

  const optionTextColor = (option: string) => {
    if (selected && current && (option === current.correct_answer || option === selected)) return '#ffffff';
    return colors.text;
  };

  // 1. LEVEL SELECTION VIEW
  if (!selectedLevel) {
    return (
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={styles.container}
      >
        <Text style={[styles.heading, { color: colors.text }]}>Cricket Quiz 🏏</Text>
        <Text style={[styles.sub, { color: colors.subText }]}>
          {userEmail ? `Logged in: ${userEmail}` : 'Choose your level and start playing'}
        </Text>

        {LEVELS.map((lvl) => (
          <TouchableOpacity
            key={lvl.key}
            activeOpacity={0.85}
            style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}
            onPress={() => handleSelectLevel(lvl.key)}
          >
            <Text style={styles.emoji}>{lvl.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{lvl.title}</Text>
              <Text style={[styles.cardDesc, { color: colors.subText }]}>{lvl.desc}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Text style={[styles.badgeText, { color: isDarkMode ? '#090d16' : '#ffffff' }]}>
                {lvl.count} Q
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  // 2. LOADING VIEW
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.info, { color: colors.subText }]}>Loading questions...</Text>
      </View>
    );
  }

  // 3. ERROR VIEW
  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text style={[styles.info, { color: colors.text }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.accent }]}
          onPress={() => loadQuestions(selectedLevel)}
        >
          <Text style={[styles.btnText, { color: btnText }]}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnOutline, { borderColor: colors.accent, marginTop: 10 }]}
          onPress={() => {
            setSelectedLevel(null);
            attemptIdRef.current = null;
            setAttemptId(null);
          }}
        >
          <Text style={[styles.btnText, { color: colors.accent }]}>Change Level</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 4. RESULT VIEW
  if (finished) {
    const total = questions.length;
    const percent = total > 0 ? Math.round((score / total) * 100) : 0;
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text style={styles.trophy}>{percent >= 70 ? '🏆' : percent >= 40 ? '👍' : '💪'}</Text>
        <Text style={[styles.resultTitle, { color: colors.text }]}>Quiz Complete!</Text>
        <Text style={[styles.resultScore, { color: colors.accent }]}>
          {score} / {total}
        </Text>
        <Text style={[styles.info, { color: colors.subText }]}>{percent}% correct answers</Text>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.accent }]}
          onPress={() => loadQuestions(selectedLevel)}
        >
          <Text style={[styles.btnText, { color: btnText }]}>Play Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnOutline, { borderColor: colors.border }]}
          onPress={() => {
            setSelectedLevel(null);
            attemptIdRef.current = null;
            setAttemptId(null);
          }}
        >
          <Text style={[styles.btnText, { color: colors.text }]}>Choose Another Level</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 5. ACTIVE QUESTION VIEW
  const progress = questions.length > 0 ? ((index + 1) / questions.length) * 100 : 0;
  if (!current) return null;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.topRow}>
        <TouchableOpacity
          onPress={() => {
            setSelectedLevel(null);
            attemptIdRef.current = null;
            setAttemptId(null);
          }}
        >
          <Text style={[styles.levelText, { color: colors.accent }]}>
            ← {selectedLevel.toUpperCase()}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.counter, { color: colors.subText }]}>
          Question {index + 1} of {questions.length}   |   Score: {score}
        </Text>
      </View>

      <View style={[styles.progressBg, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: colors.accent }]} />
      </View>

      <Text style={[styles.question, { color: colors.text }]}>{current.question}</Text>

      {current.options.map((option) => (
        <TouchableOpacity
          key={option}
          activeOpacity={0.85}
          disabled={!!selected}
          style={[styles.option, optionStyle(option)]}
          onPress={() => onSelect(option)}
        >
          <Text style={[styles.optionText, { color: optionTextColor(option) }]}>{option}</Text>
        </TouchableOpacity>
      ))}

      {selected && (
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.accent, marginTop: 20 }]}
          onPress={onNext}
        >
          <Text style={[styles.btnText, { color: btnText }]}>
            {index + 1 >= questions.length ? 'View Result' : 'Next Question'}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40, paddingTop: 30 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  info: { fontSize: 15, marginTop: 12, textAlign: 'center' },
  heading: { fontSize: 28, fontWeight: 'bold', textAlign: 'center' },
  sub: { fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  emoji: { fontSize: 32, marginRight: 14 },
  cardTitle: { fontSize: 20, fontWeight: 'bold' },
  cardDesc: { fontSize: 13, marginTop: 3 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { fontWeight: 'bold', fontSize: 13 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  levelText: { fontSize: 14, fontWeight: 'bold', letterSpacing: 1 },
  counter: { fontSize: 13 },
  progressBg: { height: 6, borderRadius: 3, marginBottom: 24, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  question: { fontSize: 20, fontWeight: 'bold', lineHeight: 28, marginBottom: 24 },
  option: { padding: 16, borderRadius: 12, borderWidth: 1.5, marginBottom: 12 },
  optionText: { fontSize: 16, fontWeight: '500' },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
    alignSelf: 'stretch',
  },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1.5 },
  btnText: { fontSize: 16, fontWeight: 'bold' },
  trophy: { fontSize: 64 },
  resultTitle: { fontSize: 26, fontWeight: 'bold', marginTop: 10 },
  resultScore: { fontSize: 44, fontWeight: 'bold', marginTop: 10 },
});