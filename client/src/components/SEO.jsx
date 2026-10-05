import { Helmet } from 'react-helmet-async';

const SEO = ({ 
  title = "WaitNot - QR Code Restaurant Ordering System | Digital Menu & Payment Solutions India",
  description = "Transform your restaurant with WaitNot's QR code ordering system. Contactless digital menus, online payments, real-time analytics. Increase revenue by 35%. Trusted by 500+ restaurants across India. Start free trial today!",
  keywords = "QR code ordering, restaurant management system, digital menu, contactless ordering, restaurant POS, online food ordering, restaurant technology, QR menu, mobile ordering, restaurant analytics, kitchen order tickets, UPI payments, restaurant software India, food tech, dine-in ordering, table ordering system",
  image = "https://waitnot.in/og-image.jpg",
  url = "https://waitnot.in",
  type = "website",
  structuredData = null
}) => {
  const siteTitle = "WaitNot";
  const fullTitle = title.includes(siteTitle) ? title : `${title} | ${siteTitle}`;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content={siteTitle} />
      
      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={url} />
      <meta property="twitter:title" content={fullTitle} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={image} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={url} />
      
      {/* Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;