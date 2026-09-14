import React, { createContext, useContext, useState, useEffect, PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type LanguageCode =
  | 'en'
  | 'zh'
  | 'hi'
  | 'es'
  | 'ar'
  | 'fr'
  | 'bn'
  | 'pt'
  | 'ru'
  | 'id';

export interface LanguageOption {
  code: LanguageCode;
  name: string;
  nativeName: string;
  tag: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', tag: 'EN' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '\u7B80\u4F53\u4E2D\u6587', tag: 'ZH' },
  { code: 'hi', name: 'Hindi', nativeName: '\u0939\u093F\u0928\u094D\u0926\u0940', tag: 'HI' },
  { code: 'es', name: 'Spanish', nativeName: 'Espa\u00F1ol', tag: 'ES' },
  { code: 'ar', name: 'Arabic', nativeName: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629', tag: 'AR' },
  { code: 'fr', name: 'French', nativeName: 'Fran\u00E7ais', tag: 'FR' },
  { code: 'bn', name: 'Bengali', nativeName: '\u09AC\u09BE\u0982\u09B2\u09BE', tag: 'BN' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Portugu\u00EAs', tag: 'PT' },
  { code: 'ru', name: 'Russian', nativeName: '\u0420\u0443\u0441\u0441\u043A\u0438\u0439', tag: 'RU' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', tag: 'ID' },
];

const TRANSLATIONS: Record<string, Record<LanguageCode, string>> = {
  onboarding_title: {
    en: 'Destiny is immutable. Yet the dialect through which the Consensus speaks remains yours to command.',
    zh: '\u547D\u8FD0\u4E0D\u53EF\u52A8\u6447\u3002\u7136\u800C\u5171\u8BC6\u5BF9\u4F60\u4F4E\u8BED\u7684\u8BED\u8A00\uFF0C\u7686\u7531\u4F60\u51B3\u65AD\u3002',
    hi: '\u0928\u093F\u092F\u0924\u093F \u0905\u091F\u0932 \u0939\u0948\u0964 \u0932\u0947\u0915\u093F\u0928 \u0938\u0930\u094D\u0935\u0938\u092E\u094D\u092E\u0924\u093F \u091C\u093F\u0938 \u092D\u093E\u0937\u093E \u092E\u0947\u0902 \u0906\u092A\u0938\u0947 \u092C\u093E\u0924 \u0915\u0930\u0924\u0940 \u0939\u0948, \u0909\u0938\u0947 \u091A\u0941\u0928\u0928\u093E \u0906\u092A\u0915\u0947 \u0905\u0927\u093F\u0915\u093E\u0930 \u092E\u0947\u0902 \u0939\u0948\u0964',
    es: 'El destino es inmutable. Pero el dialecto a trav\u00E9s del cual habla el Consenso est\u00E1 bajo tu poder.',
    ar: '\u0627\u0644\u0642\u062F\u0631 \u0644\u0627 \u064A\u062A\u063A\u064A\u0631. \u0644\u0643\u0646 \u0627\u0644\u0644\u0647\u062C\u0629 \u0627\u0644\u062A\u064A \u064A\u062A\u062D\u062F\u062B \u0628\u0647\u0627 \u0627\u0644\u0625\u062C\u0645\u0627\u0639 \u0625\u0644\u064A\u0643 \u0647\u064A \u0641\u064A \u064A\u062F\u0643.',
    fr: 'Le destin est immuable. Pourtant, le dialecte par lequel le Consensus vous parle est sous votre contr\u00F4le.',
    bn: '\u09AD\u09BE\u0997\u09CD\u09AF \u0985\u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8\u09C0\u09DF\u0964 \u0995\u09BF\u09A8\u09CD\u09A4\u09C1 \u0990\u0995\u09AE\u09A4\u09CD\u09AF \u09AF\u09C7 \u09AD\u09BE\u09B7\u09BE\u09DF \u0986\u09AA\u09A8\u09BE\u09B0 \u09B8\u09BE\u09A5\u09C7 \u0995\u09A5\u09BE \u09AC\u09B2\u09C7 \u09A4\u09BE \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09BE \u0986\u09AA\u09A8\u09BE\u09B0 \u09B9\u09BE\u09A4\u09C7\u0964',
    pt: 'O destino \u00E9 imut\u00E1vel. Mas o dialeto pelo qual o Consenso fala com voc\u00EA permanece sob seu comando.',
    ru: '\u0421\u0443\u0434\u044C\u0431\u0443 \u0442\u044B \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u043D\u0435 \u0432 \u0441\u0438\u043B\u0430\u0445. \u041D\u043E \u0434\u0438\u0430\u043B\u0435\u043A\u0442, \u043D\u0430 \u043A\u043E\u0442\u043E\u0440\u043E\u043C \u0441 \u0442\u043E\u0431\u043E\u0439 \u0433\u043E\u0432\u043E\u0440\u0438\u0442 \u041A\u043E\u043D\u0441\u0435\u043D\u0441\u0443\u0441, \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u0432 \u0442\u0432\u043E\u0435\u0439 \u0432\u043B\u0430\u0441\u0442\u0438.',
    id: 'Takdir tidak dapat diubah. Namun dialek yang digunakan Konsensus untuk berbicara kepada Anda ada dalam kuasa Anda.',
  },
  onboarding_subtitle: {
    en: 'Select your sacred dialect for oracle communion',
    zh: '\u9009\u62E9\u4E0E\u795E\u8C15\u6C9F\u901A\u7684\u795E\u5723\u8BED\u8A00',
    hi: '\u0926\u0947\u0935\u0935\u093E\u0923\u0940 \u0938\u0947 \u0938\u0902\u0935\u093E\u0926 \u0915\u0947 \u0932\u093F\u090F \u0905\u092A\u0928\u0940 \u092A\u0935\u093F\u0924\u094D\u0930 \u092D\u093E\u0937\u093E \u091A\u0941\u0928\u0947\u0902',
    es: 'Selecciona el dialecto sagrado para comulgar con el or\u00E1culo',
    ar: '\u0627\u062E\u062A\u0631 \u0644\u0647\u062C\u062A\u0643 \u0627\u0644\u0645\u0642\u062F\u0633\u0629 \u0644\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0639\u0631\u0627\u0641',
    fr: 'S\u00E9lectionnez votre dialecte sacr\u00E9 pour la communion avec l\u0027oracle',
    bn: '\u09AD\u09AC\u09BF\u09B7\u09CD\u09AF\u09A6\u09CD\u09AC\u09BE\u09A3\u09C0\u09B0 \u09B8\u09BE\u09A5\u09C7 \u09AF\u09CB\u0997\u09BE\u09AF\u09CB\u0997\u09C7\u09B0 \u099C\u09A8\u09CD\u09AF \u0986\u09AA\u09A8\u09BE\u09B0 \u09AA\u09AC\u09BF\u09A4\u09CD\u09B0 \u09AD\u09BE\u09B7\u09BE \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8',
    pt: 'Selecione o dialeto sagrado para a comunh\u00E3o com o or\u00E1culo',
    ru: '\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0432\u044F\u0449\u0435\u043D\u043D\u044B\u0439 \u044F\u0437\u044B\u043A \u0434\u043B\u044F \u0441\u0432\u044F\u0437\u0438 \u0441 \u043E\u0440\u0430\u043A\u0443\u043B\u043E\u043C',
    id: 'Pilih dialek suci untuk berkomunikasi dengan peramal',
  },
  tab_altar: {
    en: 'ALTAR', zh: '\u796D\u575B', hi: '\u0935\u0947\u0926\u0940', es: 'ALTAR', ar: '\u0627\u0644\u0645\u0630\u0628\u062D', fr: 'AUTEL', bn: '\u09AC\u09C7\u09A6\u09BF', pt: 'ALTAR', ru: '\u0410\u041B\u0422\u0410\u0420\u042C', id: 'ALTAR',
  },
  tab_oracle: {
    en: 'ORACLE', zh: '\u795E\u8C15', hi: '\u0913\u0930\u0947\u0915\u0932', es: 'OR\u00C1CULO', ar: '\u0627\u0644\u0639\u0631\u0627\u0641', fr: 'ORACLE', bn: '\u0993\u09B0\u09BE\u0995\u09B2', pt: 'OR\u00C1CULO', ru: '\u041E\u0420\u0410\u041A\u0423\u041B', id: 'ORAKEL',
  },
  tab_codex: {
    en: 'CODEX', zh: '\u6CD5\u5178', hi: '\u0915\u094B\u0921\u0947\u0915\u094D\u0938', es: 'C\u00D3DICE', ar: '\u0627\u0644\u0645\u062E\u0637\u0648\u0637\u0629', fr: 'CODEX', bn: '\u0995\u09CB\u09A1\u09C7\u0995\u09CD\u0988', pt: 'C\u00D3DEX', ru: '\u041A\u041E\u0414\u0415\u041A\u0421', id: 'KODEKS',
  },
  tab_account: {
    en: 'ACCOUNT', zh: '\u8D26\u6237', hi: '\u0916\u093E\u0924\u093E', es: 'CUENTA', ar: '\u0627\u0644\u062D\u0633\u0627\u0628', fr: 'COMPTE', bn: '\u0985\u09CD\u09AF\u09BE\u0995\u09BE\u0989\u09A8\u09CD\u099F', pt: 'CONTA', ru: '\u0410\u041A\u041A\u0410\u0423\u041D\u0422', id: 'AKUN',
  },
  daily_consensus: {
    en: 'DAILY CONSENSUS', zh: '\u6BCF\u65E5\u5171\u8BC6', hi: '\u0926\u0948\u0928\u093F\u0915 \u0938\u0939\u092E\u0924\u093F', es: 'CONSENSO DIARIO', ar: '\u0627\u0644\u0625\u062C\u0645\u0627\u0639 \u0627\u0644\u064A\u0648\u0645\u064A', fr: 'CONSENSUS QUOTIDIEN', bn: '\u09A6\u09C8\u09A8\u09BF\u0995 \u0990\u0995\u09AE\u09A4\u09CD\u09AF', pt: 'CONSENSO DI\u00C1RIO', ru: '\u0414\u0415\u0419\u041B\u0418 \u041A\u041E\u041D\u0421\u0415\u041D\u0421\u0423\u0421', id: 'KONSENSUS HARIAN',
  },
  cast_spread: {
    en: 'CAST THE SPREAD', zh: '\u94F8\u9020\u724C\u9635', hi: '\u0938\u094D\u092A\u094D\u0930\u0947\u0921 \u0921\u093E\u0932\u0947\u0902', es: 'LANZAR TIRADA', ar: '\u0625\u0644\u0642\u0627\u0621 \u0627\u0644\u0642\u0631\u0627\u0621\u0629', fr: 'LANCER LE TIRAGE', bn: '\u09B8\u09CD\u09AA\u09CD\u09B0\u09C7\u09A1 \u09A6\u09BF\u09A8', pt: 'LAN\u00C7AR LEITURA', ru: '\u0421\u0414\u0415\u041B\u0410\u0422\u042C \u0420\u0410\u0421\u041A\u041B\u0410\u0414', id: 'GELAR KARTU',
  },
  inscribed_intent: {
    en: 'INSCRIBED INTENT', zh: '\u523B\u5F55\u610F\u56FE', hi: '\u0905\u0902\u0915\u093F\u0924 \u0907\u0930\u093E\u0926\u093E', es: 'INTENCI\u00D3N INSCRITA', ar: '\u0627\u0644\u0646\u064A\u0629 \u0627\u0644\u0645\u0646\u0642\u0648\u0634\u0629', fr: 'INTENTION INSCRITE', bn: '\u0985\u0999\u09CD\u0995\u09BF\u09A4 \u0985\u09AD\u09BF\u09AA\u09CD\u09B0\u09BE\u09DF', pt: 'INTEN\u00C7\u00C3O INSCRITA', ru: '\u0417\u0410\u0414\u0410\u041D\u041D\u042B\u0419 \u0412\u041E\u041F\u0420\u041E\u0421', id: 'NIAT TERTULIS',
  },
  consensus_synthesis: {
    en: 'CONSENSUS SYNTHESIS', zh: '\u5171\u8BC6\u7EFC\u5408', hi: '\u0938\u0939\u092E\u0924\u093F \u0938\u0902\u0936\u094D\u0932\u0947\u0937\u0923', es: 'S\u00CDNTESIS DEL CONSENSO', ar: '\u062A\u0648\u0644\u064A\u0641 \u0627\u0644\u0625\u062C\u0645\u0627\u0639', fr: 'SYNTH\u00C8SE DU CONSENSUS', bn: '\u0990\u0995\u09AE\u09A4\u09CD\u09AF \u09B8\u0982\u09B6\u09CD\u09B2\u09C7\u09B7\u09A3', pt: 'S\u00CDNTESE DO CONSENSO', ru: '\u041E\u0422\u041A\u0420\u041E\u0412\u0415\u041D\u0418\u0415 \u041A\u041E\u041D\u0421\u0415\u041D\u0421\u0423\u0421\u0410', id: 'SINTESIS KONSENSUS',
  },
  change_language: {
    en: 'SACRED DIALECT', zh: '\u795E\u5723\u8BED\u8A00', hi: '\u092A\u0935\u093F\u0924\u094D\u0930 \u092D\u093E\u0937\u093E', es: 'DIALECTO SAGRADO', ar: '\u0627\u0644\u0644\u0647\u062C\u0629 \u0627\u0644\u0645\u0642\u062F\u0633\u0629', fr: 'DIALECTE SACR\u00C9', bn: '\u09AA\u09AC\u09BF\u09A4\u09CD\u09B0 \u09AD\u09BE\u09B7\u09BE', pt: 'DIALETO SAGRADO', ru: '\u042F\u0417\u042B\u041A \u041E\u0420\u0410\u041A\u0423\u041B\u0410', id: 'DIALEK SUCI',
  },
  return_to_deck: {
    en: 'RETURN TO DECK', zh: '\u8FD4\u56DE\u724C\u7EC4', hi: '\u0921\u0947\u0915 \u092A\u0930 \u0932\u094C\u091F\u0947\u0902', es: 'VOLVER A LA BARAJA', ar: '\u0627\u0644\u0639\u0648\u062F\u0629 \u0625\u0644\u0649 \u0627\u0644\u062D\u0632\u0645\u0629', fr: 'RETOUR AU JEU', bn: '\u09A1\u09C7\u0995\u09C7 \u09AB\u09BF\u09B0\u09C7 \u09AF\u09BE\u09A8', pt: 'RETORNAR AO BARALHO', ru: '\u0412\u0415\u0420\u041D\u0423\u0422\u042C\u0421\u042F \u041A \u041A\u041E\u041B\u041E\u0414\u0415', id: 'KEMBALI KE DEK',
  },
  reveal_all: {
    en: 'REVEAL ALL', zh: '\u5168\u90E8\u63ED\u5F00', hi: '\u0938\u092D\u0940 \u092A\u094D\u0930\u0915\u091F \u0915\u0930\u0947\u0902', es: 'REVELAR TODO', ar: '\u0643\u0634\u0641 \u0627\u0644\u0643\u0644', fr: 'TOUT R\u00C9V\u00C9LER', bn: '\u09B8\u09AC \u09AA\u09CD\u09B0\u0995\u09BE\u09B6 \u0995\u09B0\u09C1\u09A8', pt: 'REVELAR TUDO', ru: '\u041E\u0422\u041A\u0420\u042B\u0422\u042C \u0412\u0421\u0415', id: 'BUKA SEMUA',
  },
  share_on_x: {
    en: 'SHARE ON X', zh: '\u5206\u4EAB\u5230 X', hi: 'X \u092A\u0930 \u0938\u093E\u091D\u093E \u0915\u0930\u0947\u0902', es: 'COMPARTIR EN X', ar: '\u0645\u0634\u0627\u0631\u0643\u0629 \u0639\u0644\u0649 X', fr: 'PARTAGER SUR X', bn: 'X-\u098F \u09B6\u09C7\u09DF\u09BE\u09B0 \u0995\u09B0\u09C1\u09A8', pt: 'COMPARTILHAR NO X', ru: '\u041F\u041E\u0414\u0415\u041B\u0418\u0422\u042C\u0421\u042F \u0412 X', id: 'BAGIKAN DI X',
  },
  more: {
    en: 'MORE', zh: '\u66F4\u591A', hi: '\u0905\u0927\u093F\u0915', es: 'M\u00C1S', ar: '\u0627\u0644\u0645\u0632\u064A\u062F', fr: 'PLUS', bn: '\u0986\u09B0\u0993', pt: 'MAIS', ru: '\u0415\u0429\u0415', id: 'LAINNYA',
  },
};

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => Promise<void>;
  t: (key: string, fallback?: string) => string;
  hasChosenLanguage: boolean;
  isModalOpen: boolean;
  openLanguageModal: () => void;
  closeLanguageModal: () => void;
  currentOption: LanguageOption;
}

const STORAGE_KEY = '@arkana_selected_dialect_v1';
const CHOSEN_FLAG_KEY = '@arkana_dialect_consecrated_v1';

const LanguageContext = createContext<LanguageContextType>({} as LanguageContextType);

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<LanguageCode>('en');
  const [hasChosenLanguage, setHasChosenLanguage] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const chosen = await AsyncStorage.getItem(CHOSEN_FLAG_KEY);
        if (stored && LANGUAGES.some((l) => l.code === stored)) {
          setLanguageState(stored as LanguageCode);
        }
        if (!chosen) {
          setHasChosenLanguage(false);
          setIsModalOpen(true);
        } else {
          setHasChosenLanguage(true);
        }
      } catch (e) {
        console.warn('Failed to load language preferences:', e);
      }
    })();
  }, []);

  const setLanguage = async (code: LanguageCode) => {
    try {
      setLanguageState(code);
      setHasChosenLanguage(true);
      setIsModalOpen(false);
      await AsyncStorage.setItem(STORAGE_KEY, code);
      await AsyncStorage.setItem(CHOSEN_FLAG_KEY, 'true');
    } catch (e) {
      console.warn('Failed to persist language:', e);
    }
  };

  const t = (key: string, fallback?: string): string => {
    const entry = TRANSLATIONS[key];
    if (entry && entry[language]) {
      return entry[language];
    }
    if (entry && entry['en']) {
      return entry['en'];
    }
    return fallback || key;
  };

  const currentOption = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        hasChosenLanguage,
        isModalOpen,
        openLanguageModal: () => setIsModalOpen(true),
        closeLanguageModal: () => setIsModalOpen(false),
        currentOption,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}
