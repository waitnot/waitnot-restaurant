import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const languages = [
  // Major World Languages
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'zh', name: '中文 (Chinese)', flag: '🇨🇳' },
  { code: 'hi', name: 'हिन्दी (Hindi)', flag: '🇮🇳' },
  { code: 'es', name: 'Español (Spanish)', flag: '🇪🇸' },
  { code: 'ar', name: 'العربية (Arabic)', flag: '🇸🇦' },
  { code: 'bn', name: 'বাংলা (Bengali)', flag: '🇧🇩' },
  { code: 'pt', name: 'Português (Portuguese)', flag: '🇵🇹' },
  { code: 'ru', name: 'Русский (Russian)', flag: '🇷🇺' },
  { code: 'ja', name: '日本語 (Japanese)', flag: '🇯🇵' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ (Punjabi)', flag: '🇮🇳' },
  
  // European Languages
  { code: 'de', name: 'Deutsch (German)', flag: '🇩🇪' },
  { code: 'fr', name: 'Français (French)', flag: '🇫🇷' },
  { code: 'it', name: 'Italiano (Italian)', flag: '🇮🇹' },
  { code: 'tr', name: 'Türkçe (Turkish)', flag: '🇹🇷' },
  { code: 'pl', name: 'Polski (Polish)', flag: '🇵🇱' },
  { code: 'uk', name: 'Українська (Ukrainian)', flag: '🇺🇦' },
  { code: 'ro', name: 'Română (Romanian)', flag: '🇷🇴' },
  { code: 'nl', name: 'Nederlands (Dutch)', flag: '🇳🇱' },
  { code: 'el', name: 'Ελληνικά (Greek)', flag: '🇬🇷' },
  { code: 'cs', name: 'Čeština (Czech)', flag: '🇨🇿' },
  { code: 'sv', name: 'Svenska (Swedish)', flag: '🇸🇪' },
  { code: 'hu', name: 'Magyar (Hungarian)', flag: '🇭🇺' },
  { code: 'fi', name: 'Suomi (Finnish)', flag: '🇫🇮' },
  { code: 'no', name: 'Norsk (Norwegian)', flag: '🇳🇴' },
  { code: 'da', name: 'Dansk (Danish)', flag: '🇩🇰' },
  { code: 'bg', name: 'Български (Bulgarian)', flag: '🇧🇬' },
  { code: 'hr', name: 'Hrvatski (Croatian)', flag: '🇭🇷' },
  { code: 'sk', name: 'Slovenčina (Slovak)', flag: '🇸🇰' },
  { code: 'sl', name: 'Slovenščina (Slovenian)', flag: '🇸🇮' },
  { code: 'lt', name: 'Lietuvių (Lithuanian)', flag: '🇱🇹' },
  { code: 'lv', name: 'Latviešu (Latvian)', flag: '🇱🇻' },
  { code: 'et', name: 'Eesti (Estonian)', flag: '🇪🇪' },
  { code: 'is', name: 'Íslenska (Icelandic)', flag: '🇮🇸' },
  { code: 'ga', name: 'Gaeilge (Irish)', flag: '🇮🇪' },
  { code: 'mt', name: 'Malti (Maltese)', flag: '🇲🇹' },
  { code: 'sq', name: 'Shqip (Albanian)', flag: '🇦🇱' },
  { code: 'mk', name: 'Македонски (Macedonian)', flag: '🇲🇰' },
  { code: 'sr', name: 'Српски (Serbian)', flag: '🇷🇸' },
  { code: 'bs', name: 'Bosanski (Bosnian)', flag: '🇧🇦' },
  
  // Asian Languages
  { code: 'ko', name: '한국어 (Korean)', flag: '🇰🇷' },
  { code: 'vi', name: 'Tiếng Việt (Vietnamese)', flag: '🇻🇳' },
  { code: 'th', name: 'ไทย (Thai)', flag: '🇹🇭' },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'ms', name: 'Bahasa Melayu (Malay)', flag: '🇲🇾' },
  { code: 'tl', name: 'Tagalog (Filipino)', flag: '🇵🇭' },
  { code: 'my', name: 'မြန်မာ (Burmese)', flag: '🇲🇲' },
  { code: 'km', name: 'ខ្មែរ (Khmer)', flag: '🇰🇭' },
  { code: 'lo', name: 'ລາວ (Lao)', flag: '🇱🇦' },
  { code: 'si', name: 'සිංහල (Sinhala)', flag: '🇱🇰' },
  { code: 'ne', name: 'नेपाली (Nepali)', flag: '🇳🇵' },
  { code: 'ur', name: 'اردو (Urdu)', flag: '🇵🇰' },
  { code: 'fa', name: 'فارسی (Persian)', flag: '🇮🇷' },
  { code: 'ps', name: 'پښتو (Pashto)', flag: '🇦🇫' },
  { code: 'ku', name: 'Kurdî (Kurdish)', flag: '🇮🇶' },
  { code: 'he', name: 'עברית (Hebrew)', flag: '🇮🇱' },
  { code: 'yi', name: 'ייִדיש (Yiddish)', flag: '🇮🇱' },
  { code: 'hy', name: 'Հայերեն (Armenian)', flag: '🇦🇲' },
  { code: 'ka', name: 'ქართული (Georgian)', flag: '🇬🇪' },
  { code: 'az', name: 'Azərbaycan (Azerbaijani)', flag: '🇦🇿' },
  { code: 'kk', name: 'Қазақ (Kazakh)', flag: '🇰🇿' },
  { code: 'uz', name: 'Oʻzbek (Uzbek)', flag: '🇺🇿' },
  { code: 'mn', name: 'Монгол (Mongolian)', flag: '🇲🇳' },
  
  // Indian Languages
  { code: 'ta', name: 'தமிழ் (Tamil)', flag: '🇮🇳' },
  { code: 'te', name: 'తెలుగు (Telugu)', flag: '🇮🇳' },
  { code: 'mr', name: 'मराठी (Marathi)', flag: '🇮🇳' },
  { code: 'gu', name: 'ગુજરાતી (Gujarati)', flag: '🇮🇳' },
  { code: 'kn', name: 'ಕನ್ನಡ (Kannada)', flag: '🇮🇳' },
  { code: 'ml', name: 'മലയാളം (Malayalam)', flag: '🇮🇳' },
  { code: 'or', name: 'ଓଡ଼ିଆ (Odia)', flag: '🇮🇳' },
  { code: 'as', name: 'অসমীয়া (Assamese)', flag: '🇮🇳' },
  { code: 'sd', name: 'سنڌي (Sindhi)', flag: '🇮🇳' },
  
  // African Languages
  { code: 'sw', name: 'Kiswahili (Swahili)', flag: '🇰🇪' },
  { code: 'am', name: 'አማርኛ (Amharic)', flag: '🇪🇹' },
  { code: 'ha', name: 'Hausa', flag: '🇳🇬' },
  { code: 'yo', name: 'Yorùbá (Yoruba)', flag: '🇳🇬' },
  { code: 'ig', name: 'Igbo', flag: '🇳🇬' },
  { code: 'zu', name: 'isiZulu (Zulu)', flag: '🇿🇦' },
  { code: 'xh', name: 'isiXhosa (Xhosa)', flag: '🇿🇦' },
  { code: 'af', name: 'Afrikaans', flag: '🇿🇦' },
  { code: 'so', name: 'Soomaali (Somali)', flag: '🇸🇴' },
  { code: 'rw', name: 'Kinyarwanda', flag: '🇷🇼' },
  
  // Middle Eastern Languages
  { code: 'iw', name: 'עברית (Hebrew)', flag: '🇮🇱' },
  
  // Other Languages
  { code: 'cy', name: 'Cymraeg (Welsh)', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
  { code: 'eu', name: 'Euskara (Basque)', flag: '🇪🇸' },
  { code: 'ca', name: 'Català (Catalan)', flag: '🇪🇸' },
  { code: 'gl', name: 'Galego (Galician)', flag: '🇪🇸' },
  { code: 'la', name: 'Latina (Latin)', flag: '🇻🇦' },
  { code: 'eo', name: 'Esperanto', flag: '🌍' },
  { code: 'jw', name: 'Basa Jawa (Javanese)', flag: '🇮🇉' },
  { code: 'su', name: 'Basa Sunda (Sundanese)', flag: '🇮🇩' },
  { code: 'ceb', name: 'Cebuano', flag: '🇵🇭' },
  { code: 'hmn', name: 'Hmong', flag: '🇨🇳' },
  { code: 'ht', name: 'Kreyòl Ayisyen (Haitian Creole)', flag: '🇭🇹' },
  { code: 'mg', name: 'Malagasy', flag: '🇲🇬' },
  { code: 'mi', name: 'Māori', flag: '🇳🇿' },
  { code: 'sm', name: 'Gagana Samoa (Samoan)', flag: '🇼🇸' },
  { code: 'haw', name: 'ʻŌlelo Hawaiʻi (Hawaiian)', flag: '🇺🇸' },
  { code: 'ny', name: 'Chichewa', flag: '🇲🇼' },
  { code: 'sn', name: 'chiShona (Shona)', flag: '🇿🇼' },
  { code: 'st', name: 'Sesotho', flag: '🇱🇸' },
  { code: 'co', name: 'Corsu (Corsican)', flag: '🇫🇷' },
  { code: 'fy', name: 'Frysk (Frisian)', flag: '🇳🇱' },
  { code: 'gd', name: 'Gàidhlig (Scots Gaelic)', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { code: 'lb', name: 'Lëtzebuergesch (Luxembourgish)', flag: '🇱🇺' }
];

export default function LanguageSelector() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  const filteredLanguages = languages.filter(lang =>
    lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lang.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const changeLanguage = (code) => {
    i18n.changeLanguage(code);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative">
      {/* Language Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        title="Change Language"
      >
        <Globe size={20} className="text-gray-700" />
        <span className="text-xl">{currentLanguage.flag}</span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <Globe size={18} />
                Select Language
              </h3>
              <input
                type="text"
                placeholder="Search languages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Language List */}
            <div className="overflow-y-auto">
              {filteredLanguages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${
                    i18n.language === lang.code ? 'bg-blue-50 border-l-4 border-primary' : ''
                  }`}
                >
                  <span className="text-2xl">{lang.flag}</span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{lang.name}</p>
                    <p className="text-xs text-gray-500">{lang.code.toUpperCase()}</p>
                  </div>
                  {i18n.language === lang.code && (
                    <span className="text-primary">✓</span>
                  )}
                </button>
              ))}
              {filteredLanguages.length === 0 && (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No languages found
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-600 text-center">
              <strong>{languages.length}+ languages</strong> supported worldwide 🌍
            </div>
          </div>
        </>
      )}
    </div>
  );
}
