import React, { useState, useRef, useEffect } from "react";
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
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { API_BASE_URL } from "@/services/oracleApi";
import { ObsidianTokens } from "@/constants/theme";

interface ChatMessage {
  id: string;
  sender: "user" | "oracle";
  text: string;
  timestamp: string;
}

const PRESETS = [
  "Should I average down or cut size?",
  "Depth returns before conviction does",
  "Is this a thesis or market FOMO?",
  "Review my open risk in this cycle",
];

export default function OracleScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "oracle",
      text: "The network remembers every block. The deck reflects every market cycle. I am Arkana, The Solana Oracle. Name what you are sitting with: consensus shall respond.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [input, setInput] = useState("");
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
      sender: "user",
      text: query.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setIsTyping(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query.trim() }),
      });

      let replyText = "Depth returns before conviction does. Guard your capital and let the network confirm the floor.";
      if (res.ok) {
        const data = await res.json();
        replyText = data.reply || replyText;
      }

      const oracleMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "oracle",
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages(prev => [...prev, oracleMsg]);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    } catch (e) {
      console.warn("Chat error:", e);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "oracle",
        text: "The mempool is momentarily congested. But remember: stoic conviction outlasts market noise.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => {
        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    return () => {
      showSub.remove();
    };
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Obsidian Ritual Header */}
      <View style={styles.header}>
        <View style={styles.diamondBadge}>
          <View style={styles.innerDiamond} />
        </View>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerKicker}>ASK · ORACLE CONVERSATION</Text>
          <Text style={styles.headerTitle}>What are you sitting with?</Text>
          <Text style={styles.headerSub}>
            Arkana reads your behaviour, not the chart. It will not tell you a price.
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {messages.map(msg => (
            <View
              key={msg.id}
              style={[
                styles.messageBubble,
                msg.sender === "user" ? styles.userBubble : styles.oracleBubble,
              ]}
            >
              {msg.sender === "oracle" && (
                <Text style={styles.senderKicker}>ARKANA</Text>
              )}
              <Text
                style={[
                  styles.messageText,
                  msg.sender === "oracle" ? styles.oracleText : styles.userText,
                ]}
              >
                {msg.text}
              </Text>
              <Text style={styles.timestampText}>{msg.timestamp}</Text>
            </View>
          ))}

          {isTyping && (
            <View style={[styles.messageBubble, styles.oracleBubble, styles.typingBubble]}>
              <ActivityIndicator size="small" color={ObsidianTokens.colors.gold.primary} />
              <Text style={styles.typingText}>Reading your record...</Text>
            </View>
          )}

          {/* Prompt Presets */}
          <View style={styles.presetsWrap}>
            <Text style={styles.presetsLabel}>RITUAL PROMPTS:</Text>
            <View style={styles.presetsGrid}>
              {PRESETS.map((p, i) => (
                <Pressable
                  key={i}
                  style={({ pressed }) => [styles.presetChip, pressed && styles.chipPressed]}
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
            placeholder="Inscribe a question about size, conviction, or risk..."
            placeholderTextColor={ObsidianTokens.colors.ink.text42}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
            onFocus={() => {
              setTimeout(() => {
                scrollRef.current?.scrollToEnd({ animated: true });
              }, 120);
            }}
          />
          <Pressable
            style={({ pressed }) => [styles.sendButton, pressed && styles.chipPressed]}
            onPress={() => sendMessage()}
          >
            <Text style={styles.sendIcon}>✦</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ObsidianTokens.colors.ink.void,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingHorizontal: ObsidianTokens.spacing.screenGutter,
    paddingVertical: 14,
    borderBottomColor: ObsidianTokens.colors.gold.subtle,
    borderBottomWidth: 1,
  },
  diamondBadge: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.gold.primary,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  innerDiamond: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.gold.muted,
    transform: [{ rotate: "45deg" }],
  },
  headerTextWrap: {
    flex: 1,
  },
  headerKicker: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 2,
  },
  headerTitle: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 22,
    fontWeight: "300",
    marginTop: 2,
  },
  headerSub: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  keyboardView: {
    flex: 1,
  },
  messagesContainer: {
    paddingHorizontal: ObsidianTokens.spacing.screenGutter,
    paddingVertical: 16,
    gap: 14,
    paddingBottom: 24,
  },
  messageBubble: {
    maxWidth: "88%",
    padding: 16,
    borderRadius: ObsidianTokens.radii.panels,
  },
  oracleBubble: {
    alignSelf: "flex-start",
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
  },
  senderKicker: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 2,
    marginBottom: 6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  oracleText: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text82,
  },
  userText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text,
  },
  timestampText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text42,
    fontSize: 9,
    marginTop: 8,
    alignSelf: "flex-end",
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  typingText: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 14,
    fontStyle: "italic",
  },
  presetsWrap: {
    marginTop: 10,
  },
  presetsLabel: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  presetsGrid: {
    gap: 8,
  },
  presetChip: {
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  presetText: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 13,
  },
  chipPressed: {
    transform: [{ scale: ObsidianTokens.motion.pressScale }],
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: ObsidianTokens.spacing.screenGutter,
    paddingVertical: 10,
    borderTopColor: ObsidianTokens.colors.ink.hairline,
    borderTopWidth: 1,
    backgroundColor: ObsidianTokens.colors.ink.void,
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: ObsidianTokens.colors.ink.text,
    fontSize: 13,
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
  },
  sendButton: {
    width: 44,
    height: 44,
    backgroundColor: ObsidianTokens.colors.gold.primary,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sendIcon: {
    color: "#100C06",
    fontSize: 18,
    fontWeight: "bold",
  },
});
