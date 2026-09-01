import React from 'react';
import { useFeatures } from '../context/FeatureContext';

const FeatureGuard = ({ feature, children, fallback = null }) => {
  const { isFeatureEnabled, loading } = useFeatures();

  if (loading) {
    return fallback;
  }

  if (!isFeatureEnabled(feature)) {
    return fallback;
  }

  return children;
};

export default FeatureGuard;