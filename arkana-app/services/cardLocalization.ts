import { CardData } from '@/data/cardsData';
import { LanguageCode } from '@/services/i18n';

export type SupportedLanguage = LanguageCode;
import ruCards from '@/data/locales/cards/ru.json';
import zhCards from '@/data/locales/cards/zh.json';
import esCards from '@/data/locales/cards/es.json';
import frCards from '@/data/locales/cards/fr.json';
import ptCards from '@/data/locales/cards/pt.json';
import idCards from '@/data/locales/cards/id.json';
import hiCards from '@/data/locales/cards/hi.json';
import arCards from '@/data/locales/cards/ar.json';
import bnCards from '@/data/locales/cards/bn.json';

export interface CardTranslation {
  crypto_name?: string;
  keywords?: string[];
  symbolism?: string;
  advice?: string;
  shadow?: string;
  upright_full?: string;
  reversed_full?: string;
}

const TRANSLATION_BUNDLES: Partial<Record<SupportedLanguage, Record<string, CardTranslation>>> = {
  ru: ruCards as Record<string, CardTranslation>,
  zh: zhCards as Record<string, CardTranslation>,
  es: esCards as Record<string, CardTranslation>,
  fr: frCards as Record<string, CardTranslation>,
  pt: ptCards as Record<string, CardTranslation>,
  id: idCards as Record<string, CardTranslation>,
  hi: hiCards as Record<string, CardTranslation>,
  ar: arCards as Record<string, CardTranslation>,
  bn: bnCards as Record<string, CardTranslation>,
};

export function getCardTranslation(cardNo: string, lang: SupportedLanguage): CardTranslation | null {
  if (lang === 'en') return null;
  const bundle = TRANSLATION_BUNDLES[lang];
  return bundle?.[cardNo] || null;
}

export function localizeCard(card: CardData, lang: SupportedLanguage): CardData {
  if (!card || lang === 'en') return card;
  const t = getCardTranslation(card.card_no, lang);
  if (!t) return card;

  return {
    ...card,
    crypto_name: t.crypto_name || card.crypto_name,
    keywords: t.keywords && t.keywords.length > 0 ? t.keywords : card.keywords,
    symbolism: t.symbolism || card.symbolism,
    advice: t.advice || card.advice,
    shadow: t.shadow || card.shadow,
    upright_full: t.upright_full || card.upright_full,
    reversed_full: t.reversed_full || card.reversed_full,
  };
}

export function localizeZoomCard<T extends {
  card_no: string;
  crypto_name: string;
  advice?: string;
  shadow?: string;
  oriented_meaning?: string;
  keywords?: string[];
  symbolism?: string;
  orientation?: 'upright' | 'reversed';
}>(
  card: T,
  lang: SupportedLanguage
): T {
  if (!card || lang === 'en') return card;
  const t = getCardTranslation(card.card_no, lang);
  if (!t) return card;

  const isReversed = card.orientation === 'reversed';
  const orientedMeaning = isReversed
    ? (t.reversed_full || card.oriented_meaning)
    : (t.upright_full || card.oriented_meaning);

  return {
    ...card,
    crypto_name: t.crypto_name || card.crypto_name,
    keywords: t.keywords && t.keywords.length > 0 ? t.keywords : card.keywords,
    symbolism: t.symbolism || card.symbolism,
    advice: t.advice || card.advice,
    shadow: t.shadow || card.shadow,
    oriented_meaning: orientedMeaning,
  };
}
