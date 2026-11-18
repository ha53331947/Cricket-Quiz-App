import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../../supabase'; // Apne project ke mutabiq path check kar lein[cite: 5]
import { useTheme } from '../../context/ThemeContext';

export type QuizHistoryItem = {
  id: string;
  user_id: string;
  level: string;
  status: 'in_progress' | 'completed';
  score: number;
  total_questions: number;
  current_index: number;
  questions_state: any[];
  updated_at: string;
};

const LIMITS: Record<string, number> = { easy: 10, medium: 20, hard: 50 };

export default function ScoreHistoryScreen() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const cardBg = isDarkMode ? '#111827' : '#ffffff';
  const btnText = isDarkMode ? '#090d16' : '#ffffff';

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [historyList, setHistoryList] = useState<QuizHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUserId(data.session?.user?.id ?? null);
      setUserEmail(data.session?.user?.email ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUserId(session?.user?.id ?? null);
      setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const fetchHistory = useCallback(async (uid: string) => {
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from('quiz_history')
      .select('*')
      .eq('user_id', uid)
      .order('updated_at', { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      setHistoryList((data as QuizHistoryItem[]) ?? []);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        fetchHistory(userId);
      } else {
        setLoading(false);
      }
    }, [userId, fetchHistory])
  );

  const handleResume = (item: QuizHistoryItem) => {
    // Agar index.tsx src/app/(drawer)/index.tsx mein hai to '/(drawer)' rakho
    // Agar index.tsx src/app/index.tsx mein hai to '/' rakho
    router.navigate({
      pathname: '/(drawer)',
      params: { resumeAttemptId: item.id },
    });
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.topRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.accent }]}>← Back</Text>
        </TouchableOpacity>
        {userId && (
          <TouchableOpacity onPress={() => fetchHistory(userId)}>
            <Text style={[styles.refreshText, { color: colors.accent }]}>Refresh</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={[styles.heading, { color: colors.text }]}>Score History 📊</Text>
      <Text style={[styles.sub, { color: colors.subText }]}>
        {userEmail ? `Gmail Account: ${userEmail}` : 'Sign in with Gmail to view your history'}
      </Text>

      {!userId ? (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
          <Text style={[styles.info, { color: colors.text }]}>
            Please log in with your Gmail account to see saved quiz scores.
          </Text>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.info, { color: colors.subText }]}>Loading history...</Text>
        </View>
      ) : error ? (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: '#ef4444' }]}>
          <Text style={[styles.info, { color: '#ef4444' }]}>{error}</Text>
        </View>
      ) : historyList.length === 0 ? (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
          <Text style={[styles.info, { color: colors.subText }]}>
            "No quiz history has been saved yet."
          </Text>
        </View>
      ) : (
        historyList.map((item) => {
          const isIncomplete = item.status === 'in_progress';
          const total = item.total_questions || LIMITS[item.level] || 10;
          const dateStr = new Date(item.updated_at).toLocaleDateString();

          return (
            <View
              key={item.id}
              style={[
                styles.card,
                {
                  backgroundColor: cardBg,
                  borderColor: isIncomplete ? colors.accent : colors.border,
                },
              ]}
            >
              <View style={styles.rowBetween}>
                <Text style={[styles.levelTitle, { color: colors.text }]}>
                  {item.level.toUpperCase()}
                </Text>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: isIncomplete ? '#78350f' : '#14532d' },
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {isIncomplete ? 'Incomplete' : 'Completed'}
                  </Text>
                </View>
              </View>

              <Text style={[styles.detailText, { color: colors.subText }]}>
                Score: {item.score} / {total} • Q {Math.min(item.current_index + 1, total)} of {total}
              </Text>
              <Text style={[styles.dateText, { color: colors.subText }]}>
                Last updated: {dateStr}
              </Text>

              {isIncomplete && (
                <TouchableOpacity
                  style={[styles.resumeBtn, { backgroundColor: colors.accent }]}
                  onPress={() => handleResume(item)}
                >
                  <Text style={[styles.resumeBtnText, { color: btnText }]}>
                    ▶ Resume Quiz
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40, paddingTop: 30, flexGrow: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  backText: { fontSize: 15, fontWeight: 'bold' },
  refreshText: { fontSize: 14, fontWeight: '600' },
  heading: { fontSize: 28, fontWeight: 'bold', textAlign: 'center' },
  sub: { fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 24 },
  info: { fontSize: 15, textAlign: 'center' },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  levelTitle: { fontSize: 18, fontWeight: 'bold' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  detailText: { fontSize: 14, marginTop: 2 },
  dateText: { fontSize: 12, marginTop: 6 },
  resumeBtn: {
    marginTop: 12,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  resumeBtnText: { fontSize: 15, fontWeight: 'bold' },
});