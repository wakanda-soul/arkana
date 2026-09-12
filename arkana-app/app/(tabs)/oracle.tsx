import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { API_BASE_URL } from '@/services/oracleApi';

interface ChatMessage {
  id: string;
  sender: 'user' | 'oracle';
  text: string;
  timestamp: string;
}

const PRESETS = [
  'Стоит ли покупать токен на пампе?',
  'Оцени рыночный сантимент и ликвидность',
  'Как справиться с FUD в этом цикле?',
  'Что говорит блокчейн о моем стартапе?',
];

export default function OracleChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'oracle',
      text: 'Сеть помнит каждый блок. Карты помнят каждый паттерн. Я — Аркана, Оракул Блокчейна. Задайте ваш вопрос в свободной форме — консенсус ответит на него.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const sendMessage = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: query.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query.trim() }),
      });

      let replyText = 'Сеть обрабатывает транзакцию намерений. Консенсус формируется вокруг взвешенного риск-менеджмента.';
      if (res.ok) {
        const data = await res.json();
        replyText = data.reply || replyText;
      }

      const oracleMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'oracle',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, oracleMsg]);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    } catch (e) {
      console.warn('Chat error:', e);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'oracle',
        text: 'Мемпул временно перегружен. Но Оракул напоминает: хладнокровие валидатора побеждает рыночную суету.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.oracleBadge}>
          <Text style={styles.oracleIcon}>🔮</Text>
        </View>
        <View>
          <Text style={styles.headerTitle}>ARKANA ORACLE AI</Text>
          <Text style={styles.headerStatus}>● Live Neural Consensus</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
        >
          {messages.map(msg => (
            <View
              key={msg.id}
              style={[
                styles.messageBubble,
                msg.sender === 'user' ? styles.userBubble : styles.oracleBubble,
              ]}
            >
              {msg.sender === 'oracle' && (
                <Text style={styles.senderKicker}>ARKANA ORACLE</Text>
              )}
              <Text style={styles.messageText}>{msg.text}</Text>
              <Text style={styles.timestampText}>{msg.timestamp}</Text>
            </View>
          ))}

          {isTyping && (
            <View style={[styles.messageBubble, styles.oracleBubble, styles.typingBubble]}>
              <ActivityIndicator size="small" color="#14F195" />
              <Text style={styles.typingText}>Оракул читает состояние сети...</Text>
            </View>
          )}

          {/* Prompt Presets */}
          <View style={styles.presetsWrap}>
            <Text style={styles.presetsLabel}>БЫСТРЫЕ ВОПРОСЫ ОРАКУЛУ:</Text>
            <View style={styles.presetsGrid}>
              {PRESETS.map((p, i) => (
                <Pressable
                  key={i}
                  style={styles.presetChip}
                  onPress={() => sendMessage(p)}
                >
                  <Text style={styles.presetText}>{p}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Input Footer */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Спросите Оракула о сделке, проекте или жизни..."
            placeholderTextColor="#6B7280"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
          />
          <Pressable
            style={({ pressed }) => [styles.sendButton, pressed && styles.sendButtonPressed]}
            onPress={() => sendMessage()}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0C12',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: '#1A1E2F',
    borderBottomWidth: 1,
  },
  oracleBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E1638',
    borderColor: '#9945FF',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oracleIcon: {
    fontSize: 20,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1,
  },
  headerStatus: {
    color: '#14F195',
    fontSize: 11,
    fontWeight: '700',
  },
  keyboardView: {
    flex: 1,
  },
  messagesContainer: {
    padding: 16,
    gap: 12,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 16,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#1C1636',
    borderColor: '#9945FF',
    borderWidth: 1,
    borderBottomRightRadius: 4,
  },
  oracleBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#121422',
    borderColor: '#242A45',
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  senderKicker: {
    color: '#F5D061',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  messageText: {
    color: '#F3F4F6',
    fontSize: 14,
    lineHeight: 21,
  },
  timestampText: {
    color: '#6B7280',
    fontSize: 9,
    alignSelf: 'flex-end',
    marginTop: 6,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typingText: {
    color: '#14F195',
    fontSize: 12,
    fontStyle: 'italic',
  },
  presetsWrap: {
    marginTop: 16,
    paddingTop: 12,
  },
  presetsLabel: {
    color: '#8B949E',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    backgroundColor: '#16192A',
    borderColor: '#2D3454',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  presetText: {
    color: '#D1D5DB',
    fontSize: 12,
  },
  inputBar: {
    flexDirection: 'row',
    padding: 12,
    borderTopColor: '#1A1E2F',
    borderTopWidth: 1,
    backgroundColor: '#0E101A',
    gap: 10,
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#151726',
    borderColor: '#262C45',
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 13,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#14F195',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonPressed: {
    opacity: 0.8,
  },
  sendIcon: {
    color: '#0B0C12',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
