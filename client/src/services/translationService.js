// Translation service using browser's built-in translation or fallback
class TranslationService {
  constructor() {
    this.cache = new Map();
  }

  // Language code mapping - supports 100+ languages
  getLanguageCode(lang) {
    // Most language codes are already in ISO 639-1 format
    // Special cases that need mapping
    const mapping = {
      'zh': 'zh-CN',
      'iw': 'he',  // Hebrew alternative code
      'jw': 'jv',  // Javanese
      'ceb': 'ceb', // Cebuano
      'hmn': 'hmn', // Hmong
      'haw': 'haw'  // Hawaiian
    };
    return mapping[lang] || lang;
  }

  // Create cache key
  getCacheKey(text, targetLang) {
    return `${text}_${targetLang}`;
  }

  // Translate using MyMemory Translation API (free, no API key needed)
  async translateText(text, targetLang, sourceLang = 'en') {
    if (!text || targetLang === 'en') return text;

    const cacheKey = this.getCacheKey(text, targetLang);
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const targetCode = this.getLanguageCode(targetLang);
      const sourceCode = this.getLanguageCode(sourceLang);
      
      // Use MyMemory Translation API (free, 1000 requests/day)
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceCode}|${targetCode}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.responseStatus === 200 && data.responseData) {
        const translated = data.responseData.translatedText;
        this.cache.set(cacheKey, translated);
        return translated;
      }
      
      return text; // Return original if translation fails
    } catch (error) {
      console.error('Translation error:', error);
      return text; // Return original text on error
    }
  }

  // Translate multiple texts at once
  async translateBatch(texts, targetLang, sourceLang = 'en') {
    const promises = texts.map(text => this.translateText(text, targetLang, sourceLang));
    return await Promise.all(promises);
  }

  // Translate menu item
  async translateMenuItem(item, targetLang) {
    if (targetLang === 'en') return item;

    const [translatedName, translatedDescription, translatedCategory] = await this.translateBatch(
      [item.name, item.description || '', item.category],
      targetLang
    );

    return {
      ...item,
      name: translatedName,
      description: translatedDescription,
      category: translatedCategory
    };
  }

  // Translate restaurant data
  async translateRestaurant(restaurant, targetLang) {
    if (targetLang === 'en') return restaurant;

    const [translatedName, translatedDescription] = await this.translateBatch(
      [restaurant.name, restaurant.description || ''],
      targetLang
    );

    // Translate cuisine names
    const translatedCuisine = restaurant.cuisine ? 
      await this.translateBatch(restaurant.cuisine, targetLang) : 
      restaurant.cuisine;

    // Translate menu items
    const translatedMenu = await Promise.all(
      restaurant.menu.map(item => this.translateMenuItem(item, targetLang))
    );

    return {
      ...restaurant,
      name: translatedName,
      description: translatedDescription,
      cuisine: translatedCuisine,
      menu: translatedMenu
    };
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }
}

export default new TranslationService();
