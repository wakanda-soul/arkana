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
  Keyboard,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { PublicKey } from "@solana/web3.js";
import { useAuth } from "@/components/auth/auth-provider";
import {
  fetchClockInStatus,
  setRemoteSeekerStatus,
  ClockInResult,
  sendOracleChatMessage,
  API_BASE_URL,
} from "@/services/oracleApi";
import { ObsidianTokens } from "@/constants/theme";
import { ALL_CARDS } from "@/data/cardsData";
import { CardImages } from "@/assets/cards";
import { CardZoomModal, ZoomCardData } from "@/components/tarot/CardZoomModal";
import { ShuffleCeremony } from "@/components/tarot/ShuffleCeremony";
import { MarkdownText } from "@/components/ui/MarkdownText";
import { unlockCards } from "@/services/codexService";
import { useLanguage } from "@/services/i18n";
import { localizeZoomCard } from "@/services/cardLocalization";
import { useMobileWallet } from "@wallet-ui/react-native-web3js";
import { checkSeekerGenesisHolderOnChain, fetchRealSkrBalance } from "@/services/solanaService";
import { executePaymentOrSwap, getVerifiedTreasury } from "@/services/treasuryService";

interface ChatMessage {
  id: string;
  sender: "user" | "oracle";
  text: string;
  timestamp: string;
  card?: ZoomCardData | null;
}

interface RitualPrompt {
  id: string;
  category: "LIFE" | "CRAFT" | "BONDS" | "CAPITAL";
  text: string;
}

const RITUAL_CATEGORIES = [
  { key: "ALL", labelKey: "cat_all_prompts", defaultLabel: "ALL PROMPTS" },
  { key: "LIFE", labelKey: "cat_path_destiny", defaultLabel: "PATH & DESTINY" },
  { key: "CRAFT", labelKey: "cat_creation_work", defaultLabel: "CREATION & WORK" },
  { key: "BONDS", labelKey: "cat_relationships", defaultLabel: "RELATIONSHIPS" },
  { key: "CAPITAL", labelKey: "cat_risk_capital", defaultLabel: "RISK & CAPITAL" },
] as const;

const DIVERSE_PROMPTS: RitualPrompt[] = [
  // LIFE & DESTINY
  { id: "l1", category: "LIFE", text: "I am standing at a crossroads. Where should I commit my energy?" },
  { id: "l2", category: "LIFE", text: "What hidden resistance is blocking my next phase of growth?" },
  { id: "l3", category: "LIFE", text: "Should I stay patient for clarity or force movement now?" },
  { id: "l4", category: "LIFE", text: "What recurring pattern am I repeating that no longer serves me?" },

  // CREATION & WORK
  { id: "c1", category: "CRAFT", text: "Am I building from genuine purpose or fear of falling behind?" },
  { id: "c2", category: "CRAFT", text: "How do I break through the creative stagnation I feel right now?" },
  { id: "c3", category: "CRAFT", text: "Is my vision ahead of its time or lacking execution discipline?" },
  { id: "c4", category: "CRAFT", text: "What friction must I eliminate to accelerate my work?" },

  // RELATIONSHIPS & BONDS
  { id: "b1", category: "BONDS", text: "Is this connection strengthening my spirit or scattering my energy?" },
  { id: "b2", category: "BONDS", text: "What truth about myself am I refusing to acknowledge here?" },
  { id: "b3", category: "BONDS", text: "How do I maintain boundaries without closing off trust?" },
  { id: "b4", category: "BONDS", text: "What unspoken tension needs to be brought into the open?" },

  // CAPITAL & CONVICTION
  { id: "k1", category: "CAPITAL", text: "Is this allocation driven by deep conviction or fleeting FOMO?" },
  { id: "k2", category: "CAPITAL", text: "Review my psychological posture towards my current risk." },
  { id: "k3", category: "CAPITAL", text: "Should I guard capital reserves or aggressively seize expansion?" },
  { id: "k4", category: "CAPITAL", text: "Where is market noise blinding me to structural reality?" },
];

export default function OracleScreen() {
  const { account } = useAuth();
  const { connection, signAndSendTransactions } = useMobileWallet();
  const { t, language } = useLanguage();
  const walletAddress = account?.publicKey?.toString() || "";

  const [quotaInfo, setQuotaInfo] = useState<ClockInResult | null>(null);
  const [onChainSkr, setOnChainSkr] = useState<number | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "oracle",
      text: t("oracle_initial_message", "The network remembers every block. The deck reflects human nature across market cycles, life thresholds, and internal conflicts. I am Arkana, The Solana Oracle. Name what you are sitting with: consensus shall respond."),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length <= 1) {
        return [
          {
            id: "1",
            sender: "oracle",
            text: t("oracle_initial_message", "The network remembers every block. The deck reflects human nature across market cycles, life thresholds, and internal conflicts. I am Arkana, The Solana Oracle. Name what you are sitting with: consensus shall respond."),
            timestamp: prev[0]?.timestamp || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ];
      }
      return prev;
    });
  }, [language]);

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [zoomedCard, setZoomedCard] = useState<ZoomCardData | null>(null);
  const [solModalVisible, setSolModalVisible] = useState(false);
  const [promptsModalVisible, setPromptsModalVisible] = useState(false);
  const [pendingQuery, setPendingQuery] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!walletAddress) return;
    const syncStatus = async () => {
      let isHolder = false;
      if (account?.publicKey) {
        try {
          isHolder = await checkSeekerGenesisHolderOnChain(connection, account.publicKey);
          await setRemoteSeekerStatus(walletAddress, isHolder);
        } catch (err) {
          console.warn('[Seeker SBT] check failed in Oracle:', err);
        }
      }
      try {
        const info = await fetchClockInStatus(walletAddress, account?.publicKey ? isHolder : undefined);
        setQuotaInfo(info);
      } catch (err) {
        console.warn('Failed to fetch quota info in Oracle:', err);
      }
    };

    syncStatus();

    if (account?.publicKey) {
      fetchRealSkrBalance(connection, account.publicKey).then(val => {
        setOnChainSkr(val);
      }).catch(() => {});
    }
  }, [walletAddress, account?.publicKey, connection]);

  const handleInitiateSend = (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query) return;

    if (!walletAddress) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: "oracle",
          text: t("connect_wallet_for_oracle", "Connect your Solana wallet to commune with Arkana."),
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      return;
    }

    const isSeeker = Boolean(quotaInfo?.isSeekerHolder);
    const hasFree = isSeeker && (quotaInfo?.freeSpreadsRemaining ?? 0) > 0;

    // If 3 free daily attempts are exhausted or user is not a Seeker SBT holder: ALWAYS prompt user with mystical warning popup!
    if (!hasFree) {
      setPendingQuery(query);
      setSolModalVisible(true);
      return;
    }

    executeSendMessage(query, false);
  };

  const handleConfirmPaidCommune = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}
    const query = pendingQuery || input;
    if (!query) return;

    const userPubkey = account?.publicKey
      ? new PublicKey(account.publicKey)
      : walletAddress
      ? new PublicKey(walletAddress)
      : null;

    if (!userPubkey || !signAndSendTransactions) {
      Alert.alert(
        t('wallet_required', 'Wallet Required'),
        t('connect_wallet_first', 'Please connect your Solana wallet to commune with Arkana.')
      );
      return;
    }

    const askCost = quotaInfo?.askCostSkr || 1;
    setIsProcessingPayment(true);

    try {
      const treasuryPubkey = await getVerifiedTreasury(API_BASE_URL);
      const paymentResult = await executePaymentOrSwap({
        connection,
        userPublicKey: userPubkey,
        treasuryPublicKey: treasuryPubkey,
        amountSkr: askCost,
        actionLabel: 'ORACLE_ASK',
        signAndSendTransactions,
      });

      setSolModalVisible(false);
      setPendingQuery("");
      await executeSendMessage(query, false, paymentResult.signature);
    } catch (err: any) {
      console.warn('Paid commune payment error:', err);
      Alert.alert(
        t('offering_failed_title', 'Offering Incomplete'),
        err?.message || t('offering_failed_desc', 'Transaction could not be confirmed. No funds were debited.')
      );
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleReturnTomorrow = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSolModalVisible(false);
  };

  const executeSendMessage = async (query: string, payWithSol: boolean = false, txSignature?: string | null) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    setSolModalVisible(false);

    try {
      const data = await sendOracleChatMessage({
        message: query,
        wallet: walletAddress,
        payWithSol,
        txSignature: txSignature || null,
        language,
      });

      let cardPayload: ZoomCardData | null = null;
      if (data.card) {
        cardPayload = {
          card_no: data.card.card_no,
          crypto_name: data.card.crypto_name,
          classic: data.card.classic,
          orientation: (data.card.orientation || "upright").toLowerCase() as "upright" | "reversed",
          advice: data.card.advice,
          oriented_meaning: data.card.oriented_meaning,
          keywords: data.card.keywords || [],
          suit: data.card.suit,
          arcana: data.card.arcana,
        };
        unlockCards([data.card.card_no]);
      }

      if (data.quota) {
        setQuotaInfo((prev) =>
          prev
            ? {
                ...prev,
                freeSpreadsRemaining: data.quota!.remainingFree,
                skrBalance: data.quota!.balance,
              }
            : null
        );
      }

      const oracleMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "oracle",
        text: data.reply || "Consensus has acknowledged your inquiry.",
        card: cardPayload,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, oracleMsg]);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    } catch (e: any) {
      if (e.quota && !e.quota.allowed) {
        setPendingQuery(query);
        setSolModalVisible(true);
        setIsTyping(false);
        return;
      }

      console.warn("Chat error, engaging offline oracle synthesis:", e);
      const fallbackCard = ALL_CARDS[Math.floor(Math.random() * ALL_CARDS.length)];
      const isReversed = Math.random() > 0.75;
      const cardPayload: ZoomCardData = {
        card_no: fallbackCard.card_no,
        crypto_name: fallbackCard.crypto_name,
        classic: fallbackCard.classic,
        orientation: isReversed ? "reversed" : "upright",
        advice: fallbackCard.advice,
        oriented_meaning: isReversed ? fallbackCard.reversed_full : fallbackCard.upright_full,
        keywords: fallbackCard.keywords || [],
        suit: fallbackCard.suit,
        arcana: fallbackCard.arcana,
      };
      unlockCards([fallbackCard.card_no]);

      const oracleMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "oracle",
        text: `Consensus has drawn **${fallbackCard.crypto_name}** (${fallbackCard.suit}) for your inquiry.\n\n${
          isReversed ? fallbackCard.reversed_full : fallbackCard.upright_full || fallbackCard.advice
        }\n\n*The ledger remembers all: build with conviction.*`,
        card: cardPayload,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, oracleMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleConfirmSolPayment = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}
    if (pendingQuery) {
      await executeSendMessage(pendingQuery, true);
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

  const isSeekerHolder = Boolean(quotaInfo?.isSeekerHolder);
  const hasFreeRemaining = isSeekerHolder && (quotaInfo?.freeSpreadsRemaining ?? 0) > 0;
  const freeRemaining = isSeekerHolder ? (quotaInfo?.freeSpreadsRemaining ?? 0) : 0;
  const askCostSkr = quotaInfo?.askCostSkr || 1;
  const askCostSol = quotaInfo?.askCostSol || 0.0002;
  const skrBalance = onChainSkr !== null ? onChainSkr : 0;

  const filteredPrompts = selectedCategory === "ALL"
    ? DIVERSE_PROMPTS
    : DIVERSE_PROMPTS.filter((p) => p.category === selectedCategory);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Obsidian Ritual Header */}
      <View style={styles.header}>
        <View style={styles.diamondBadge}>
          <View style={styles.innerDiamond} />
        </View>
        <View style={styles.headerTextWrap}>
          <View style={styles.headerKickerRow}>
            <Text style={styles.headerKicker}>{t('oracle_tab_kicker', 'ASK \u00B7 ORACLE CONVERSATION')}</Text>
            <View style={styles.quotaPill}>
              <Text style={styles.quotaPillText}>
                {hasFreeRemaining
                  ? `${freeRemaining} ${t('free_badge', 'FREE')}`
                  : skrBalance >= askCostSkr
                  ? `${askCostSkr} SKR`
                  : `${askCostSol} SOL`}
              </Text>
            </View>
          </View>
          <Text style={styles.headerTitle}>{t('oracle_header_title', 'What are you sitting with?')}</Text>
          <Text style={styles.headerSub}>
            {t('oracle_header_sub', 'Arkana reads patterns beyond charts: life thresholds, craft, bonds, and conviction.')}
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
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.messageBubble,
                msg.sender === "user" ? styles.userBubble : styles.oracleBubble,
              ]}
            >
              {msg.sender === "oracle" && (
                <View style={styles.oracleHeaderRow}>
                  <Text style={styles.senderKicker}>ARKANA</Text>
                  {msg.card && (
                    <Text style={styles.cardDrawnKicker}>
                      {t("archetype_drawn_kicker", "ARCHETYPE: {name}", { name: msg.card.crypto_name.toUpperCase() })}
                    </Text>
                  )}
                </View>
              )}

              {/* Mini Tarot Card Widget if card is present */}
              {msg.card && (
                <Pressable
                  style={({ pressed }) => [
                    styles.chatCardWidget,
                    pressed && styles.chipPressed,
                  ]}
                  onPress={() => {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch {}
                    setZoomedCard(localizeZoomCard(msg.card!, language));
                  }}
                >
                  <View style={styles.chatCardImageWrap}>
                    <Image
                      source={CardImages[msg.card.card_no] || CardImages["00"]}
                      style={[
                        styles.chatCardImage,
                        msg.card.orientation === "reversed" && styles.cardImageReversed,
                      ]}
                      contentFit="cover"
                    />
                  </View>

                  <View style={styles.chatCardInfo}>
                    <View style={styles.chatCardTopLine}>
                      <Text style={styles.chatCardNo}>NO. {msg.card.card_no}</Text>
                      <View
                        style={[
                          styles.chatOrientationBadge,
                          msg.card.orientation === "reversed"
                            ? styles.badgeReversed
                            : styles.badgeUpright,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chatOrientationText,
                            msg.card.orientation === "reversed"
                              ? styles.badgeTextReversed
                              : styles.badgeTextUpright,
                          ]}
                        >
                          {msg.card.orientation === "reversed" ? t("drawn_reversed", "\u25BC REVERSED") : t("drawn_upright", "\u25B2 UPRIGHT")}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.chatCardName} numberOfLines={1}>
                      {localizeZoomCard(msg.card, language).crypto_name}
                    </Text>

                    <View style={styles.chatInspectButton}>
                      <Text style={styles.chatInspectText}>{t("inspect_archetype", "INSPECT ARCHETYPE \u2922")}</Text>
                    </View>
                  </View>
                </Pressable>
              )}

              {/* Message Text: Markdown rendered for Oracle, plain mono for user */}
              {msg.sender === "oracle" ? (
                <MarkdownText content={msg.text} />
              ) : (
                <Text style={styles.userText}>{msg.text}</Text>
              )}

              <Text style={styles.timestampText}>{msg.timestamp}</Text>
            </View>
          ))}

          {/* Typing indicator: animated card shuffle ritual */}
          {isTyping && (
            <View style={[styles.messageBubble, styles.oracleBubble, styles.typingCeremonyBubble]}>
              <ShuffleCeremony
                compact
                title={t("arkana_consulting_deck", "Arkana is consulting the deck...")}
                subtitle={t("drawing_archetype", "DRAWING ARCHETYPE_")}
              />
            </View>
          )}

          {/* Diverse Categorized Ritual Prompts - shown only on welcome state when messages.length <= 1 */}
          {messages.length <= 1 && (
            <View style={styles.presetsWrap}>
              <View style={styles.presetsHeaderRow}>
                <Text style={styles.presetsLabel}>{t("archetypal_inquiries", "ARCHETYPAL INQUIRIES")}</Text>
                <Text style={styles.presetsCount}>{t("prompts_count", "{count} PROMPTS", { count: filteredPrompts.length })}</Text>
              </View>

              {/* Category Filter Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
                {RITUAL_CATEGORIES.map((cat) => {
                  const isActive = selectedCategory === cat.key;
                  return (
                    <Pressable
                      key={cat.key}
                      style={({ pressed }) => [
                        styles.categoryTab,
                        isActive && styles.categoryTabActive,
                        pressed && styles.chipPressed,
                      ]}
                      onPress={() => {
                        try {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } catch {}
                        setSelectedCategory(cat.key);
                      }}
                    >
                      <Text
                        style={[
                          styles.categoryTabText,
                          isActive && styles.categoryTabTextActive,
                        ]}
                      >
                        {t(cat.labelKey, cat.defaultLabel)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Prompts Grid */}
              <View style={styles.presetsGrid}>
                {filteredPrompts.map((p) => (
                  <Pressable
                    key={p.id}
                    style={({ pressed }) => [styles.presetChip, pressed && styles.chipPressed]}
                    onPress={() => handleInitiateSend(t("prompt_" + p.id, p.text))}
                  >
                    <Text style={styles.presetCategoryTag}>{p.category}</Text>
                    <Text style={styles.presetText}>{t("prompt_" + p.id, p.text)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Quota Status Bar above Input */}
        <View style={styles.inputStatusRow}>
          <View style={styles.inputStatusBadge}>
            <Text style={styles.inputStatusDot}>{'\u2726'}</Text>
            <Text style={styles.inputStatusText}>
              {hasFreeRemaining
                ? t('free_inquiries_remaining', '{n} free daily inquiries remaining (shared with spreads)', { n: freeRemaining })
                : skrBalance >= askCostSkr
                ? t('skr_per_inquiry', '{cost} SKR per inquiry \u00B7 Balance: {balance} SKR', { cost: askCostSkr, balance: skrBalance })
                : t('sol_per_inquiry', '{cost} SOL per inquiry (SKR balance: 0)', { cost: askCostSol })}
            </Text>
          </View>
        </View>

        {/* Input Footer */}
        <View style={styles.inputBar}>
          <Pressable
            style={({ pressed }) => [styles.inspirationButton, pressed && styles.chipPressed]}
            onPress={() => {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch {}
              setPromptsModalVisible(true);
            }}
            accessibilityLabel="Prompts"
          >
            <Text style={styles.inspirationIcon}>{'\u2726'}</Text>
          </Pressable>

          <TextInput
            style={styles.textInput}
            placeholder={t('ask_oracle_placeholder', 'Ask Arkana...')}
            placeholderTextColor={ObsidianTokens.colors.ink.text42}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => handleInitiateSend()}
            returnKeyType="send"
            onFocus={() => {
              setTimeout(() => {
                scrollRef.current?.scrollToEnd({ animated: true });
              }, 120);
            }}
          />
          <Pressable
            style={({ pressed }) => [styles.sendButton, pressed && styles.chipPressed]}
            onPress={() => handleInitiateSend()}
          >
            <Text style={styles.sendIcon}>{'\u2191'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Card Zoom Modal */}
      <CardZoomModal
        card={zoomedCard}
        onClose={() => setZoomedCard(null)}
      />

      {/* Archetypal Inquiries Bottom Sheet Modal */}
      <Modal
        visible={promptsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPromptsModalVisible(false)}
      >
        <View style={styles.promptsModalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPromptsModalVisible(false)}
          />
          <View style={styles.promptsModalCard}>
            <View style={styles.promptsModalHeader}>
              <View style={styles.promptsModalTitleRow}>
                <Text style={styles.promptsModalEmblem}>{'\u2726'}</Text>
                <Text style={styles.promptsModalTitle}>
                  {t("archetypal_inquiries", "ARCHETYPAL INQUIRIES")}
                </Text>
              </View>
              <Pressable
                onPress={() => setPromptsModalVisible(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.promptsModalCloseBtn}
              >
                <Text style={styles.promptsModalCloseText}>{'\u2715'}</Text>
              </Pressable>
            </View>

            {/* Category Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
              style={{ maxHeight: 50, marginBottom: 8 }}
            >
              {RITUAL_CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.key;
                return (
                  <Pressable
                    key={cat.key}
                    style={({ pressed }) => [
                      styles.categoryTab,
                      isActive && styles.categoryTabActive,
                      pressed && styles.chipPressed,
                    ]}
                    onPress={() => {
                      try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      } catch {}
                      setSelectedCategory(cat.key);
                    }}
                  >
                    <Text
                      style={[
                        styles.categoryTabText,
                        isActive && styles.categoryTabTextActive,
                      ]}
                    >
                      {t(cat.labelKey, cat.defaultLabel)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Prompts list in bottom sheet */}
            <ScrollView
              style={styles.promptsModalScroll}
              contentContainerStyle={styles.promptsModalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {filteredPrompts.map((p) => (
                <Pressable
                  key={p.id}
                  style={({ pressed }) => [
                    styles.promptsModalItem,
                    pressed && styles.chipPressed,
                  ]}
                  onPress={() => {
                    setPromptsModalVisible(false);
                    handleInitiateSend(t("prompt_" + p.id, p.text));
                  }}
                >
                  <View style={styles.promptsModalItemTop}>
                    <Text style={styles.presetCategoryTag}>{p.category}</Text>
                    <Text style={styles.promptsModalItemArrow}>{'\u2192'}</Text>
                  </View>
                  <Text style={styles.presetText}>{t("prompt_" + p.id, p.text)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Mystical Quota Limit Warning Modal */}
      <Modal
        visible={solModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleReturnTomorrow}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalEmblem}>
                <Text style={styles.modalEmblemText}>{'\u2726'}</Text>
              </View>
              <Pressable
                onPress={handleReturnTomorrow}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalCloseText}>{'\u2715'}</Text>
              </Pressable>
            </View>

            <Text style={styles.modalKicker}>
              {isSeekerHolder
                ? t('quota_modal_kicker', 'CONSENSUS QUOTA \u00B7 3/3 USED TODAY')
                : t('seeker_sbt_required_kicker', 'SEEKER GENESIS SBT PRIVILEGE')}
            </Text>
            <Text style={styles.modalTitle}>{t('quota_veil_drawn_title', 'The Veil Has Drawn')}</Text>
            <Text style={styles.modalSub}>
              {isSeekerHolder
                ? t('quota_veil_drawn_desc', 'You have exhausted the 3 sacred inquiries granted to you by the ledger today.\n\nThe cards now require an offering of energy to part the veil once more. Will you commune now, or return tomorrow when the next UTC block seals?')
                : t('seeker_sbt_privilege_desc', 'Free daily readings are an exclusive privilege of Solana Seeker Genesis SBT holders.\n\nPart the veil by offering SKR or SOL to commune with Arkana.')}
            </Text>

            <View style={styles.modalInfoPanel}>
              <View style={styles.modalPriceRow}>
                <Text style={styles.modalPriceLabel}>
                  {skrBalance >= askCostSkr ? t('sacred_offering_skr', 'SACRED OFFERING (SKR)') : t('sacred_offering_sol', 'SACRED OFFERING (SOL)')}
                </Text>
                <Text style={styles.modalPriceValue}>
                  {skrBalance >= askCostSkr ? `${askCostSkr} SKR` : `${askCostSol} SOL`}
                </Text>
              </View>
              <Text style={styles.modalPriceSub}>
                {skrBalance >= askCostSkr
                  ? t('offering_skr_sub', 'Wallet balance: {balance} SKR \u00B7 Inscribed on-chain', { balance: skrBalance })
                  : t('offering_sol_sub', 'Zero SKR on wallet \u00B7 Paid in SOL via Solana consensus ({cost} SOL)', { cost: askCostSol })}
              </Text>
            </View>

            {pendingQuery ? (
              <View style={styles.modalPromptPreview}>
                <Text style={styles.modalPromptLabel}>{t('pending_inquiry_label', 'PENDING INQUIRY:')}</Text>
                <Text style={styles.modalPromptText} numberOfLines={2}>
                  &quot;{pendingQuery}&quot;
                </Text>
              </View>
            ) : null}

            <View style={styles.modalButtonsColumn}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalPayBtn,
                  pressed && styles.chipPressed,
                  isProcessingPayment && styles.btnDisabled,
                ]}
                onPress={handleConfirmPaidCommune}
                disabled={isProcessingPayment}
              >
                {isProcessingPayment ? (
                  <ActivityIndicator color="#100C06" />
                ) : (
                  <Text style={styles.modalPayBtnText}>
                    {skrBalance >= askCostSkr
                      ? t('ask_now_offer_skr', 'ASK NOW \u00B7 OFFER {cost} SKR', { cost: askCostSkr })
                      : t('ask_now_offer_sol', 'ASK NOW \u00B7 OFFER {cost} SOL', { cost: askCostSol })}
                  </Text>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalCancelBtn, pressed && styles.chipPressed]}
                onPress={handleReturnTomorrow}
                disabled={isProcessingPayment}
              >
                <Text style={styles.modalCancelBtnText}>{t('return_tomorrow_btn', 'RETURN TOMORROW (NEXT UTC BLOCK)')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingVertical: 12,
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
  headerKickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerKicker: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 2,
  },
  quotaPill: {
    backgroundColor: "rgba(200, 162, 74, 0.15)",
    borderColor: ObsidianTokens.colors.gold.primary,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  quotaPillText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 8.5,
    fontWeight: "700",
    letterSpacing: 1,
  },
  headerTitle: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 21,
    fontWeight: "300",
    marginTop: 2,
  },
  headerSub: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  keyboardView: {
    flex: 1,
  },
  messagesContainer: {
    paddingHorizontal: ObsidianTokens.spacing.screenGutter,
    paddingVertical: 14,
    gap: 12,
    paddingBottom: 24,
  },
  messageBubble: {
    maxWidth: "88%",
    padding: 14,
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
  oracleHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  senderKicker: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 2,
  },
  cardDrawnKicker: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.muted,
    fontSize: 8,
    letterSpacing: 1.2,
  },
  chatCardWidget: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0E0B16",
    borderColor: "rgba(200, 162, 74, 0.4)",
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
    gap: 12,
  },
  chatCardImageWrap: {
    width: 52,
    height: 78,
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.gold.subtle,
    backgroundColor: ObsidianTokens.colors.ink.void,
  },
  chatCardImage: {
    width: "100%",
    height: "100%",
  },
  cardImageReversed: {
    transform: [{ rotateZ: "180deg" }],
  },
  chatCardInfo: {
    flex: 1,
    justifyContent: "center",
  },
  chatCardTopLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  chatCardNo: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    fontSize: 8,
    letterSpacing: 1.5,
    color: ObsidianTokens.colors.gold.primary,
  },
  chatOrientationBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeUpright: {
    backgroundColor: ObsidianTokens.colors.gold.surface,
    borderColor: ObsidianTokens.colors.gold.subtle,
  },
  badgeReversed: {
    backgroundColor: "rgba(212, 82, 64, 0.15)",
    borderColor: "#D45240",
  },
  chatOrientationText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    fontSize: 7,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  badgeTextUpright: {
    color: ObsidianTokens.colors.gold.primary,
  },
  badgeTextReversed: {
    color: "#EDE7DC",
  },
  chatCardName: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    fontSize: 14,
    fontWeight: "600",
    color: ObsidianTokens.colors.ink.text,
  },
  chatCardClassic: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    fontSize: 11,
    fontStyle: "italic",
    color: ObsidianTokens.colors.ink.text55,
    marginBottom: 4,
  },
  chatInspectButton: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(200, 162, 74, 0.12)",
    borderColor: "rgba(200, 162, 74, 0.35)",
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  chatInspectText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    fontSize: 7.5,
    letterSpacing: 1,
    color: ObsidianTokens.colors.gold.primary,
    fontWeight: "600",
  },
  userText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 14,
    lineHeight: 20,
  },
  timestampText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text42,
    fontSize: 9,
    marginTop: 8,
    alignSelf: "flex-end",
  },
  typingCeremonyBubble: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  presetsWrap: {
    marginTop: 14,
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  presetsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  presetsLabel: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "600",
  },
  presetsCount: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text42,
    fontSize: 8.5,
    letterSpacing: 1,
  },
  categoryScroll: {
    flexDirection: "row",
    gap: 6,
    paddingBottom: 8,
  },
  categoryTab: {
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  categoryTabActive: {
    backgroundColor: ObsidianTokens.colors.gold.surface,
    borderColor: ObsidianTokens.colors.gold.primary,
  },
  categoryTabText: {
    fontSize: 11,
    fontWeight: "500",
    color: ObsidianTokens.colors.ink.text55,
  },
  categoryTabTextActive: {
    color: ObsidianTokens.colors.gold.primary,
    fontWeight: "700",
  },
  presetsGrid: {
    gap: 7,
    marginTop: 4,
  },
  presetChip: {
    backgroundColor: ObsidianTokens.colors.ink.void,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  presetCategoryTag: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    fontSize: 7.5,
    letterSpacing: 1.2,
    color: ObsidianTokens.colors.gold.muted,
    marginBottom: 3,
  },
  presetText: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text82,
    fontSize: 12.5,
    lineHeight: 17,
  },
  chipPressed: {
    transform: [{ scale: ObsidianTokens.motion.pressScale }],
  },
  inputStatusRow: {
    paddingHorizontal: ObsidianTokens.spacing.screenGutter,
    paddingVertical: 4,
  },
  inputStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inputStatusDot: {
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 8,
  },
  inputStatusText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text42,
    fontSize: 8.5,
    letterSpacing: 0.8,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: ObsidianTokens.spacing.screenGutter,
    paddingVertical: 8,
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
    paddingVertical: 10,
    color: ObsidianTokens.colors.ink.text,
    fontSize: 13,
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
  },
  inspirationButton: {
    width: 44,
    height: 44,
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  inspirationIcon: {
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 16,
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
  promptsModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(3, 2, 6, 0.8)",
    justifyContent: "flex-end",
  },
  promptsModalCard: {
    backgroundColor: "#0E0B16",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 16,
    paddingBottom: Platform.select({ ios: 36, android: 24, default: 20 }),
    paddingHorizontal: ObsidianTokens.spacing.screenGutter,
    maxHeight: "75%",
  },
  promptsModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  promptsModalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  promptsModalEmblem: {
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 14,
  },
  promptsModalTitle: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "600",
  },
  promptsModalCloseBtn: {
    padding: 6,
  },
  promptsModalCloseText: {
    color: ObsidianTokens.colors.ink.text42,
    fontSize: 16,
  },
  promptsModalScroll: {
    marginTop: 6,
  },
  promptsModalScrollContent: {
    gap: 8,
    paddingBottom: 16,
  },
  promptsModalItem: {
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  promptsModalItemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  promptsModalItemArrow: {
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(3, 2, 6, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#0E0B16",
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    shadowColor: ObsidianTokens.colors.gold.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  modalEmblem: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.gold.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  modalEmblemText: {
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 14,
  },
  modalCloseText: {
    color: ObsidianTokens.colors.ink.text42,
    fontSize: 16,
  },
  modalKicker: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 8.5,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  modalTitle: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 20,
    fontWeight: "300",
    marginBottom: 4,
  },
  modalSub: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 14,
  },
  modalInfoPanel: {
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  modalPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  modalPriceLabel: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: ObsidianTokens.colors.gold.primary,
  },
  modalPriceValue: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    fontSize: 13,
    fontWeight: "700",
    color: ObsidianTokens.colors.ink.text,
  },
  modalPriceSub: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    fontSize: 10.5,
    color: ObsidianTokens.colors.ink.text42,
    fontStyle: "italic",
  },
  modalPromptPreview: {
    backgroundColor: ObsidianTokens.colors.ink.void,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  modalPromptLabel: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    fontSize: 7.5,
    letterSpacing: 1,
    color: ObsidianTokens.colors.gold.muted,
    marginBottom: 3,
  },
  modalPromptText: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    fontSize: 12,
    color: ObsidianTokens.colors.ink.text82,
    fontStyle: "italic",
  },
  modalButtonsColumn: {
    gap: 8,
  },
  modalPayBtn: {
    backgroundColor: ObsidianTokens.colors.gold.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalPayBtnText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: "#100C06",
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelBtnText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text42,
    fontSize: 9.5,
    letterSpacing: 1,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
