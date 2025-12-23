import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import translationService from '../services/translationService';

export function useContentTranslation(content, type = 'text') {
  const { i18n } = useTranslation();
  const [translatedContent, setTranslatedContent] = useState(content);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    const translateContent = async () => {
      if (!content || i18n.language === 'en') {
        setTranslatedContent(content);
        return;
      }

      setIsTranslating(true);
      
      try {
        let translated;
        
        if (type === 'restaurant') {
          translated = await translationService.translateRestaurant(content, i18n.language);
        } else if (type === 'menuItem') {
          translated = await translationService.translateMenuItem(content, i18n.language);
        } else {
          translated = await translationService.translateText(content, i18n.language);
        }
        
        setTranslatedContent(translated);
      } catch (error) {
        console.error('Translation error:', error);
        setTranslatedContent(content);
      } finally {
        setIsTranslating(false);
      }
    };

    translateContent();
  }, [content, i18n.language, type]);

  return { translatedContent, isTranslating };
}

export function useRestaurantTranslation(restaurant) {
  return useContentTranslation(restaurant, 'restaurant');
}

export function useMenuItemTranslation(menuItem) {
  return useContentTranslation(menuItem, 'menuItem');
}
