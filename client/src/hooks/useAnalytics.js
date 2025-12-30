import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView, initGA } from '../utils/analytics';

// Custom hook for Google Analytics
export const useAnalytics = () => {
  const location = useLocation();

  useEffect(() => {
    // Initialize GA on first load
    initGA();
  }, []);

  useEffect(() => {
    // Track page views on route changes
    const url = window.location.origin + location.pathname + location.search;
    const title = document.title;
    
    // Small delay to ensure page title is updated
    setTimeout(() => {
      trackPageView(url, title);
    }, 100);
  }, [location]);

  return null;
};

// Hook for tracking user interactions
export const useTrackEvent = () => {
  return {
    trackPageView,
    trackEvent: (action, category, label, value) => {
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', action, {
          event_category: category,
          event_label: label,
          value: value,
        });
      }
    },
    trackClick: (elementName, page) => {
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'click', {
          event_category: 'UI_Interaction',
          event_label: elementName,
          page: page
        });
      }
    },
    trackFormSubmit: (formName, success = true) => {
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'form_submit', {
          event_category: 'Forms',
          event_label: formName,
          success: success
        });
      }
    },
    trackDownload: (fileName, fileType) => {
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'file_download', {
          event_category: 'Downloads',
          event_label: fileName,
          file_type: fileType
        });
      }
    }
  };
};