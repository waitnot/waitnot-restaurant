// Helper function to translate text that might be a translation key or regular text
export const translateText = (t, text) => {
  if (!text) return '';
  
  // Try to translate, if no translation exists, return original text
  const translated = t(text, { defaultValue: text });
  return translated;
};

// Category mapping for consistent translation
export const translateCategory = (t, category) => {
  const categoryMap = {
    'Starters': t('Starters'),
    'Main Course': t('Main Course'),
    'Desserts': t('Desserts'),
    'Drinks': t('Drinks')
  };
  
  return categoryMap[category] || category;
};
