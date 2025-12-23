// Number formatting for different languages
export const formatNumber = (number, language) => {
  const num = Number(number);
  
  // Number systems for different languages
  const numberSystems = {
    'ar': 'arab',      // Arabic-Indic digits
    'hi': 'deva',      // Devanagari digits
    'bn': 'beng',      // Bengali digits
    'th': 'thai',      // Thai digits
    'fa': 'arabext',   // Extended Arabic-Indic digits
  };

  const numberingSystem = numberSystems[language];

  if (numberingSystem) {
    return new Intl.NumberFormat(`${language}-u-nu-${numberingSystem}`).format(num);
  }

  // Default formatting for other languages
  return new Intl.NumberFormat(language).format(num);
};

// Format currency with proper symbol and number system
export const formatCurrency = (amount, language, currency = 'INR') => {
  const num = Number(amount);
  
  // Currency symbols for different languages
  const currencySymbols = {
    'INR': {
      'en': '₹',
      'hi': '₹',
      'ar': 'روبية',
      'default': '₹'
    }
  };

  const symbol = currencySymbols[currency]?.[language] || currencySymbols[currency]?.['default'] || '₹';
  const formattedNumber = formatNumber(num, language);

  // For Arabic and RTL languages, put symbol after number
  if (language === 'ar' || language === 'fa' || language === 'ur') {
    return `${formattedNumber} ${symbol}`;
  }

  return `${symbol}${formattedNumber}`;
};

// Convert Western Arabic numerals to other number systems
export const convertNumerals = (text, language) => {
  if (!text) return text;
  
  const numeralSystems = {
    'ar': ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'],
    'hi': ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'],
    'bn': ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'],
    'th': ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'],
  };

  const numerals = numeralSystems[language];
  if (!numerals) return text;

  return String(text).replace(/\d/g, (digit) => numerals[parseInt(digit)]);
};
