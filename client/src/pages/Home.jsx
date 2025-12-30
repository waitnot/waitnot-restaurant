import { useState } from 'react';
import { QrCode, Smartphone, Clock, TrendingUp, Shield, Zap, BarChart3, CreditCard, Users, CheckCircle, Star, Play, X, Check, Minus } from 'lucide-react';
import SEO from '../components/SEO';
import { trackEvent, trackWhatsAppEvent, trackPricingEvent, trackEngagement } from '../utils/analytics';

export default function Home() {
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    email: '',
    phone: '',
    restaurantName: '',
    preferredDate: '',
    preferredTime: '',
    message: ''
  });

  // Scroll to CTA section
  const scrollToCTA = () => {
    trackEvent('click', 'Navigation', 'Get_Started_Today_Button');
    const ctaSection = document.getElementById('cta-section');
    if (ctaSection) {
      ctaSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Open WhatsApp with pre-filled message
  const openWhatsApp = (context = 'Start_Free_Trial') => {
    trackWhatsAppEvent('click', context);
    const phoneNumber = '916364039135';
    const message = encodeURIComponent(
      `Hi! I'm interested in starting a free trial of WaitNot for my restaurant. Could you please help me get started with the QR code ordering system?

Restaurant Details:
- Looking for: Free Trial
- Interest: QR Code Ordering & Payment System
- Need: Setup assistance

Please contact me to discuss the next steps.

Thank you!`
    );
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  // Handle schedule form submission
  const handleScheduleSubmit = (e) => {
    e.preventDefault();
    
    // Create WhatsApp message with form data
    const phoneNumber = '916364039135';
    const message = encodeURIComponent(
      `Hi! I would like to schedule a demo of WaitNot for my restaurant.

Demo Request Details:
👤 Name: ${scheduleForm.name}
📧 Email: ${scheduleForm.email}
📱 Phone: ${scheduleForm.phone}
🏪 Restaurant: ${scheduleForm.restaurantName}
📅 Preferred Date: ${scheduleForm.preferredDate}
⏰ Preferred Time: ${scheduleForm.preferredTime}

${scheduleForm.message ? `Additional Message: ${scheduleForm.message}` : ''}

Please confirm the demo schedule at your earliest convenience.

Thank you!`
    );
    
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
    window.open(whatsappUrl, '_blank');
    
    // Reset form and close modal
    setScheduleForm({
      name: '',
      email: '',
      phone: '',
      restaurantName: '',
      preferredDate: '',
      preferredTime: '',
      message: ''
    });
    setShowScheduleModal(false);
  };

  // Demo Modal Component
  const DemoModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-2xl font-bold text-black">WaitNot Demo Video</h3>
          <button
            onClick={() => setShowDemoModal(false)}
            className="text-gray-500 hover:text-black"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-6">
          <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Play size={64} className="text-red-600 mx-auto mb-4" />
              <h4 className="text-xl font-bold text-black mb-2">Demo Video Coming Soon</h4>
              <p className="text-gray-600 mb-6">
                Our comprehensive demo video is currently being prepared. 
                In the meantime, you can schedule a live demo with our team.
              </p>
              <button
                onClick={() => {
                  setShowDemoModal(false);
                  setShowScheduleModal(true);
                }}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
              >
                Schedule Live Demo Instead
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Schedule Modal Component
  const ScheduleModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-2xl font-bold text-black">Schedule Demo</h3>
          <button
            onClick={() => setShowScheduleModal(false)}
            className="text-gray-500 hover:text-black"
          >
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleScheduleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-black mb-2">Full Name *</label>
              <input
                type="text"
                required
                value={scheduleForm.name}
                onChange={(e) => setScheduleForm({...scheduleForm, name: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="Your full name"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-black mb-2">Email *</label>
              <input
                type="email"
                required
                value={scheduleForm.email}
                onChange={(e) => setScheduleForm({...scheduleForm, email: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="your@email.com"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-black mb-2">Phone Number *</label>
              <input
                type="tel"
                required
                value={scheduleForm.phone}
                onChange={(e) => setScheduleForm({...scheduleForm, phone: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="+91 9876543210"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-black mb-2">Restaurant Name *</label>
              <input
                type="text"
                required
                value={scheduleForm.restaurantName}
                onChange={(e) => setScheduleForm({...scheduleForm, restaurantName: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="Your restaurant name"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-black mb-2">Preferred Date *</label>
              <input
                type="date"
                required
                value={scheduleForm.preferredDate}
                onChange={(e) => setScheduleForm({...scheduleForm, preferredDate: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-black mb-2">Preferred Time *</label>
              <select
                required
                value={scheduleForm.preferredTime}
                onChange={(e) => setScheduleForm({...scheduleForm, preferredTime: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              >
                <option value="">Select time</option>
                <option value="10:00 AM">10:00 AM</option>
                <option value="11:00 AM">11:00 AM</option>
                <option value="12:00 PM">12:00 PM</option>
                <option value="2:00 PM">2:00 PM</option>
                <option value="3:00 PM">3:00 PM</option>
                <option value="4:00 PM">4:00 PM</option>
                <option value="5:00 PM">5:00 PM</option>
                <option value="6:00 PM">6:00 PM</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-black mb-2">Additional Message</label>
            <textarea
              value={scheduleForm.message}
              onChange={(e) => setScheduleForm({...scheduleForm, message: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              rows="3"
              placeholder="Any specific requirements or questions..."
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => setShowScheduleModal(false)}
              className="flex-1 border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
            >
              Schedule Demo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
  // Structured Data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "WaitNot - QR Code Restaurant Ordering System",
    "description": "Transform your restaurant with WaitNot's QR code ordering system. Contactless digital menus, online payments, real-time analytics. Increase revenue by 35%.",
    "url": "https://waitnot.in",
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://waitnot.in"
        }
      ]
    },
    "mainEntity": {
      "@type": "SoftwareApplication",
      "name": "WaitNot",
      "applicationCategory": "RestaurantManagementSoftware",
      "operatingSystem": "Web Browser",
      "offers": [
        {
          "@type": "Offer",
          "name": "Starter Plan",
          "price": "99",
          "priceCurrency": "INR",
          "description": "Perfect for small cafés and food stalls",
          "availability": "https://schema.org/InStock"
        },
        {
          "@type": "Offer",
          "name": "Pro Plan",
          "price": "2999",
          "priceCurrency": "INR",
          "description": "Most popular plan for restaurants",
          "availability": "https://schema.org/InStock"
        },
        {
          "@type": "Offer",
          "name": "Premium POS Plan",
          "price": "6999",
          "priceCurrency": "INR",
          "description": "Enterprise solution for restaurant chains",
          "availability": "https://schema.org/InStock"
        }
      ],
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "reviewCount": "500",
        "bestRating": "5",
        "worstRating": "1"
      },
      "author": {
        "@type": "Organization",
        "name": "WaitNot Technologies",
        "url": "https://waitnot.in"
      }
    }
  };

  return (
    <>
      <SEO 
        title="Restaurant Management System | Digital Menu & QR Code Ordering | Best Restaurant Software India 2024"
        description="#1 Restaurant Management System in India. Digital menu, QR code ordering, POS system, online payments. Trusted by 1000+ restaurants. Increase revenue by 40%. Free trial available!"
        keywords="restaurant management system, digital menu, QR code ordering, restaurant software, POS system, online food ordering, restaurant technology, digital restaurant menu, contactless ordering, restaurant POS software, food ordering system, restaurant app, menu management system, kitchen order system, restaurant billing software, table ordering system, restaurant automation, food service technology, restaurant point of sale, digital ordering system, restaurant operations software, menu digitization, QR menu system, restaurant tech solutions, food tech India, restaurant software India, best restaurant management system, restaurant management software, digital restaurant solutions, restaurant technology platform, food service management, restaurant business software, hospitality management system, restaurant inventory management, restaurant analytics software, restaurant payment system, mobile ordering system, restaurant dashboard, food ordering platform, restaurant CRM, restaurant marketing software, restaurant reporting system, restaurant staff management, multi-location restaurant software, restaurant chain management, franchise restaurant software, cloud restaurant software, restaurant data analytics, restaurant customer management, restaurant loyalty program, restaurant feedback system, restaurant review management, restaurant social media integration, restaurant delivery management, restaurant takeaway system, restaurant dine-in system, restaurant reservation system, restaurant table management, restaurant queue management, restaurant kitchen management, restaurant supply chain, restaurant procurement system, restaurant cost control, restaurant profit optimization, restaurant sales tracking, restaurant performance metrics, restaurant business intelligence, restaurant growth software, restaurant scalability solutions, restaurant efficiency tools, restaurant productivity software, restaurant workflow automation, restaurant process optimization, restaurant digital transformation, restaurant modernization, restaurant innovation, restaurant competitive advantage, restaurant success platform, restaurant revenue optimization, restaurant customer experience, restaurant service quality, restaurant operational excellence, restaurant management best practices, restaurant industry solutions, restaurant sector technology, hospitality industry software, food and beverage management, restaurant consulting software, restaurant training system, restaurant compliance management, restaurant health safety, restaurant hygiene management, restaurant quality control, restaurant brand management, restaurant franchise solutions, restaurant enterprise software, restaurant SME solutions, restaurant startup tools, restaurant growth hacking, restaurant market penetration, restaurant customer acquisition, restaurant retention strategies, restaurant upselling tools, restaurant cross-selling system, restaurant menu optimization, restaurant pricing strategy, restaurant demand forecasting, restaurant trend analysis, restaurant market research, restaurant competitor analysis, restaurant benchmarking, restaurant KPI tracking, restaurant ROI measurement, restaurant success metrics, restaurant performance dashboard, restaurant real-time monitoring, restaurant live reporting, restaurant instant notifications, restaurant alert system, restaurant emergency management, restaurant crisis handling, restaurant business continuity, restaurant disaster recovery, restaurant backup solutions, restaurant data security, restaurant privacy protection, restaurant GDPR compliance, restaurant data encryption, restaurant secure payments, restaurant fraud prevention, restaurant risk management, restaurant audit trail, restaurant compliance reporting, restaurant regulatory adherence, restaurant legal compliance, restaurant tax management, restaurant accounting integration, restaurant financial reporting, restaurant expense tracking, restaurant budget management, restaurant cash flow optimization, restaurant working capital, restaurant investment tracking, restaurant profitability analysis, restaurant cost optimization, restaurant margin improvement, restaurant efficiency gains, restaurant productivity boost, restaurant automation benefits, restaurant digital advantages, restaurant competitive edge, restaurant market leadership, restaurant industry dominance, restaurant success stories, restaurant case studies, restaurant testimonials, restaurant reviews, restaurant ratings, restaurant awards, restaurant recognition, restaurant certifications, restaurant partnerships, restaurant integrations, restaurant ecosystem, restaurant marketplace, restaurant network, restaurant community, restaurant support, restaurant training, restaurant onboarding, restaurant implementation, restaurant migration, restaurant setup, restaurant configuration, restaurant customization, restaurant personalization, restaurant branding, restaurant white label, restaurant private label, restaurant OEM solutions, restaurant API, restaurant SDK, restaurant developer tools, restaurant third party integrations, restaurant plugin system, restaurant extension marketplace, restaurant add-ons, restaurant modules, restaurant features, restaurant functionality, restaurant capabilities, restaurant specifications, restaurant requirements, restaurant compatibility, restaurant system requirements, restaurant technical specifications, restaurant architecture, restaurant infrastructure, restaurant scalability, restaurant performance, restaurant reliability, restaurant availability, restaurant uptime, restaurant SLA, restaurant support levels, restaurant maintenance, restaurant updates, restaurant upgrades, restaurant roadmap, restaurant future plans, restaurant innovation pipeline, restaurant research development, restaurant technology trends, restaurant industry insights, restaurant market analysis, restaurant business intelligence, restaurant strategic planning, restaurant growth strategies, restaurant expansion plans, restaurant international markets, restaurant global solutions, restaurant localization, restaurant multi-language, restaurant multi-currency, restaurant regional compliance, restaurant local regulations, restaurant cultural adaptation, restaurant market entry, restaurant business development, restaurant sales enablement, restaurant marketing automation, restaurant lead generation, restaurant customer onboarding, restaurant user experience, restaurant interface design, restaurant usability, restaurant accessibility, restaurant mobile optimization, restaurant responsive design, restaurant cross-platform, restaurant device compatibility, restaurant browser support, restaurant operating system support, restaurant cloud deployment, restaurant on-premise installation, restaurant hybrid solutions, restaurant flexible deployment, restaurant scalable architecture, restaurant microservices, restaurant API-first design, restaurant headless commerce, restaurant omnichannel, restaurant unified platform, restaurant single source truth, restaurant data integration, restaurant system integration, restaurant workflow integration, restaurant process automation, restaurant business rules, restaurant configuration management, restaurant version control, restaurant change management, restaurant release management, restaurant deployment automation, restaurant continuous integration, restaurant continuous deployment, restaurant DevOps, restaurant agile development, restaurant rapid deployment, restaurant quick implementation, restaurant fast setup, restaurant instant activation, restaurant immediate results, restaurant quick wins, restaurant rapid ROI, restaurant fast payback, restaurant immediate benefits, restaurant instant impact, restaurant quick transformation, restaurant rapid modernization, restaurant fast digitization, restaurant immediate automation, restaurant quick optimization, restaurant rapid improvement, restaurant fast growth, restaurant immediate success, restaurant quick scaling, restaurant rapid expansion, restaurant fast market entry, restaurant immediate competitive advantage, restaurant quick differentiation, restaurant rapid innovation, restaurant fast adaptation, restaurant immediate response, restaurant quick recovery, restaurant rapid resilience, restaurant fast transformation, restaurant immediate evolution, restaurant quick revolution, restaurant rapid disruption, restaurant fast innovation, restaurant immediate breakthrough, restaurant quick advancement, restaurant rapid progress, restaurant fast development, restaurant immediate enhancement, restaurant quick upgrade, restaurant rapid modernization, restaurant fast optimization, restaurant immediate efficiency, restaurant quick productivity, restaurant rapid performance, restaurant fast results, restaurant immediate outcomes, restaurant quick achievements, restaurant rapid success, restaurant fast victory, restaurant immediate triumph, restaurant quick excellence, restaurant rapid mastery, restaurant fast leadership, restaurant immediate dominance, restaurant quick supremacy, restaurant rapid superiority, restaurant fast advantage, restaurant immediate edge, restaurant quick benefit, restaurant rapid gain, restaurant fast profit, restaurant immediate revenue, restaurant quick income, restaurant rapid earnings, restaurant fast returns, restaurant immediate ROI, restaurant quick payback, restaurant rapid recovery, restaurant fast break-even, restaurant immediate profitability, restaurant quick sustainability, restaurant rapid viability, restaurant fast feasibility, restaurant immediate practicality, restaurant quick applicability, restaurant rapid usability, restaurant fast functionality, restaurant immediate operability, restaurant quick workability, restaurant rapid effectiveness, restaurant fast efficiency, restaurant immediate productivity, restaurant quick performance, restaurant rapid excellence, restaurant fast quality, restaurant immediate reliability, restaurant quick dependability, restaurant rapid trustworthiness, restaurant fast credibility, restaurant immediate authenticity, restaurant quick legitimacy, restaurant rapid validity, restaurant fast accuracy, restaurant immediate precision, restaurant quick correctness, restaurant rapid exactness, restaurant fast perfection, restaurant immediate optimization, restaurant quick enhancement, restaurant rapid improvement, restaurant fast advancement, restaurant immediate progress, restaurant quick development, restaurant rapid evolution, restaurant fast transformation, restaurant immediate revolution, restaurant quick innovation, restaurant rapid creativity, restaurant fast ingenuity, restaurant immediate brilliance, restaurant quick intelligence, restaurant rapid wisdom, restaurant fast expertise, restaurant immediate mastery, restaurant quick proficiency, restaurant rapid competency, restaurant fast capability, restaurant immediate capacity, restaurant quick potential, restaurant rapid possibility, restaurant fast opportunity, restaurant immediate advantage, restaurant quick benefit, restaurant rapid value, restaurant fast worth, restaurant immediate importance, restaurant quick significance, restaurant rapid relevance, restaurant fast applicability, restaurant immediate suitability, restaurant quick appropriateness, restaurant rapid fitness, restaurant fast compatibility, restaurant immediate alignment, restaurant quick synchronization, restaurant rapid coordination, restaurant fast integration, restaurant immediate unification, restaurant quick consolidation, restaurant rapid centralization, restaurant fast standardization, restaurant immediate optimization, restaurant quick streamlining, restaurant rapid simplification, restaurant fast clarification, restaurant immediate transparency, restaurant quick visibility, restaurant rapid accessibility, restaurant fast availability, restaurant immediate readiness, restaurant quick preparedness, restaurant rapid responsiveness, restaurant fast adaptability, restaurant immediate flexibility, restaurant quick agility, restaurant rapid mobility, restaurant fast portability, restaurant immediate scalability, restaurant quick expandability, restaurant rapid extensibility, restaurant fast customizability, restaurant immediate configurability, restaurant quick personalization, restaurant rapid individualization, restaurant fast specialization, restaurant immediate differentiation, restaurant quick uniqueness, restaurant rapid distinctiveness, restaurant fast exclusivity, restaurant immediate specialty, restaurant quick expertise, restaurant rapid mastery, restaurant fast leadership, restaurant immediate authority, restaurant quick credibility, restaurant rapid reputation, restaurant fast recognition, restaurant immediate acknowledgment, restaurant quick appreciation, restaurant rapid gratitude, restaurant fast satisfaction, restaurant immediate happiness, restaurant quick joy, restaurant rapid delight, restaurant fast pleasure, restaurant immediate contentment, restaurant quick fulfillment, restaurant rapid achievement, restaurant fast accomplishment, restaurant immediate success, restaurant quick victory, restaurant rapid triumph, restaurant fast excellence, restaurant immediate perfection, restaurant quick optimization, restaurant rapid maximization, restaurant fast enhancement, restaurant immediate improvement, restaurant quick advancement, restaurant rapid progress, restaurant fast development, restaurant immediate growth, restaurant quick expansion, restaurant rapid scaling, restaurant fast multiplication, restaurant immediate amplification, restaurant quick magnification, restaurant rapid intensification, restaurant fast strengthening, restaurant immediate empowerment, restaurant quick enablement, restaurant rapid facilitation, restaurant fast assistance, restaurant immediate support, restaurant quick help, restaurant rapid aid, restaurant fast service, restaurant immediate solution, restaurant quick answer, restaurant rapid response, restaurant fast reaction, restaurant immediate action, restaurant quick implementation, restaurant rapid execution, restaurant fast delivery, restaurant immediate provision, restaurant quick supply, restaurant rapid distribution, restaurant fast dissemination, restaurant immediate communication, restaurant quick information, restaurant rapid knowledge, restaurant fast learning, restaurant immediate education, restaurant quick training, restaurant rapid development, restaurant fast improvement, restaurant immediate enhancement, restaurant quick optimization, restaurant rapid perfection, restaurant fast excellence, restaurant immediate quality, restaurant quick reliability, restaurant rapid dependability, restaurant fast trustworthiness, restaurant immediate credibility, restaurant quick authenticity, restaurant rapid legitimacy, restaurant fast validity, restaurant immediate accuracy, restaurant quick precision, restaurant rapid correctness, restaurant fast exactness, restaurant immediate perfection"
        structuredData={structuredData}
      />
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <header className="bg-gradient-to-br from-red-600 to-black text-white">
        <div className="max-w-7xl mx-auto px-4 py-20 sm:py-32">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6 text-gray-100">
              The Future of Restaurant Technology
            </h2>
            <p className="text-xl sm:text-2xl mb-12 text-gray-200 max-w-4xl mx-auto leading-relaxed">
              Revolutionize your restaurant operations with QR code ordering, real-time analytics, 
              and seamless payment processing. Increase efficiency, reduce costs, and delight customers.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <button 
                onClick={scrollToCTA}
                className="bg-red-600 hover:bg-red-700 text-white px-10 py-4 rounded-lg font-bold text-lg transition-all transform hover:scale-105 shadow-lg"
                aria-label="Get started with WaitNot today"
              >
                Get Started Today
              </button>
              <button 
                onClick={() => setShowDemoModal(true)}
                className="border-2 border-white text-white hover:bg-white hover:text-black px-10 py-4 rounded-lg font-bold text-lg transition-all"
                aria-label="Watch WaitNot demo video"
              >
                Watch Demo
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* SEO Content Section - Hidden but crawlable */}
      <section className="sr-only" aria-hidden="true">
        <h2>Restaurant Management System India</h2>
        <p>Best restaurant management system in India for digital menu, QR code ordering, POS system, online food ordering, restaurant software, contactless ordering, restaurant technology, menu management system, kitchen order system, restaurant billing software, table ordering system, restaurant automation, food service technology, restaurant point of sale, digital ordering system, restaurant operations software, menu digitization, QR menu system, restaurant tech solutions, food tech India, restaurant software India, restaurant management software, digital restaurant solutions, restaurant technology platform, food service management, restaurant business software, hospitality management system, restaurant inventory management, restaurant analytics software, restaurant payment system, mobile ordering system, restaurant dashboard, food ordering platform.</p>
        
        <h3>Digital Menu System</h3>
        <p>Create digital restaurant menu with QR code ordering system. Best digital menu software for restaurants in India. Menu management system with online ordering, contactless menu, QR menu system, digital menu app, restaurant menu software, menu digitization, electronic menu, smart menu system, interactive menu, mobile menu, tablet menu, digital menu board, menu display system, restaurant menu management.</p>
        
        <h3>Restaurant POS System</h3>
        <p>Complete restaurant POS system with billing, inventory, staff management. Best restaurant point of sale software India. Restaurant billing software, POS system for restaurants, restaurant cash register, point of sale system, restaurant billing system, POS software, restaurant checkout system, payment processing, restaurant transactions, sales tracking, restaurant payments.</p>
        
        <h3>QR Code Ordering System</h3>
        <p>Contactless QR code ordering system for restaurants. Best QR ordering software India. QR code menu, QR ordering system, contactless ordering, scan and order, QR menu system, digital ordering, mobile ordering, table ordering, self-service ordering, touchless ordering, QR code restaurant, scan to order, QR payment system.</p>
        
        <h3>Online Food Ordering</h3>
        <p>Online food ordering system for restaurants. Best food ordering platform India. Restaurant online ordering, food delivery system, takeaway ordering, dine-in ordering, restaurant ordering app, food ordering software, online menu ordering, restaurant e-commerce, food ordering platform, digital food ordering.</p>
        
        <h3>Restaurant Software India</h3>
        <p>Best restaurant software in India for management, ordering, billing, analytics. Restaurant management software India, restaurant technology India, restaurant automation India, restaurant digitization India, restaurant software solutions, restaurant tech platform, restaurant business software, hospitality software India, food service software.</p>
        
        <h3>Contactless Restaurant Solutions</h3>
        <p>Contactless ordering and payment solutions for restaurants. Contactless dining, touchless ordering, contactless menu, contactless payment, safe dining, hygienic ordering, contactless restaurant technology, touchless restaurant system, contactless food ordering, safe restaurant operations.</p>
        
        <h3>Restaurant Technology Solutions</h3>
        <p>Advanced restaurant technology solutions for modern restaurants. Restaurant innovation, restaurant digitization, restaurant automation, smart restaurant technology, restaurant tech stack, restaurant digital transformation, modern restaurant solutions, restaurant efficiency tools, restaurant productivity software.</p>
        
        <h3>Menu Management System</h3>
        <p>Complete menu management system for restaurants. Menu creation, menu editing, menu pricing, menu categories, menu items management, menu updates, menu analytics, menu optimization, menu performance tracking, seasonal menu management, dynamic menu pricing.</p>
        
        <h3>Kitchen Order System</h3>
        <p>Kitchen order ticket system for restaurant operations. KOT system, kitchen display system, order management, kitchen workflow, order tracking, kitchen operations, food preparation management, kitchen efficiency, order processing, kitchen automation, restaurant kitchen technology.</p>
        
        <h3>Restaurant Analytics Software</h3>
        <p>Restaurant analytics and reporting software for business intelligence. Sales analytics, customer analytics, menu analytics, performance metrics, restaurant insights, business intelligence, data analytics, restaurant reporting, sales tracking, revenue optimization, restaurant KPIs.</p>
        
        <h3>Restaurant Payment System</h3>
        <p>Secure restaurant payment processing system. UPI payments, card payments, digital payments, online payments, payment gateway, payment processing, secure transactions, payment analytics, payment reconciliation, multi-payment options, cashless payments.</p>
        
        <h3>Mobile Ordering System</h3>
        <p>Mobile ordering system for restaurants without app download. Mobile-friendly ordering, responsive ordering system, smartphone ordering, tablet ordering, mobile payments, mobile menu, mobile restaurant system, mobile POS, mobile analytics.</p>
        
        <h3>Restaurant Dashboard</h3>
        <p>Comprehensive restaurant management dashboard for owners and managers. Real-time dashboard, analytics dashboard, sales dashboard, operations dashboard, performance dashboard, business intelligence dashboard, restaurant metrics, live reporting, instant notifications.</p>
        
        <h3>Food Ordering Platform</h3>
        <p>Complete food ordering platform for restaurants and customers. Multi-restaurant platform, food marketplace, ordering ecosystem, restaurant network, food delivery platform, takeaway platform, dine-in platform, comprehensive food ordering solution.</p>
      </section>

      {/* Benefits for Restaurants Section */}
      <section className="py-20 bg-gray-50" aria-labelledby="restaurant-benefits">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 id="restaurant-benefits" className="text-4xl sm:text-5xl font-bold text-black mb-6">
              Transform Your Restaurant Business
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Join hundreds of restaurants already using WaitNot to increase revenue, 
              reduce operational costs, and provide exceptional customer experiences.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" role="list">
            {/* Restaurant Benefit 1 */}
            <article className="bg-white rounded-xl shadow-lg p-8 border-l-4 border-red-600 hover:shadow-xl transition-shadow" role="listitem">
              <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-6" aria-hidden="true">
                <TrendingUp className="text-red-600" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-black mb-4">Increase Revenue by 35%</h3>
              <p className="text-gray-600 mb-4">
                Faster table turnover, reduced wait times, and upselling opportunities through digital menus 
                lead to significant revenue growth.
              </p>
              <ul className="text-sm text-gray-500 space-y-2" aria-label="Revenue increase features">
                <li>• Faster order processing</li>
                <li>• Higher order accuracy</li>
                <li>• Automated upselling suggestions</li>
              </ul>
            </article>

            {/* Restaurant Benefit 2 */}
            <article className="bg-white rounded-xl shadow-lg p-8 border-l-4 border-red-600 hover:shadow-xl transition-shadow" role="listitem">
              <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-6" aria-hidden="true">
                <BarChart3 className="text-red-600" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-black mb-4">Real-Time Analytics</h3>
              <p className="text-gray-600 mb-4">
                Make data-driven decisions with comprehensive insights into sales, popular items, 
                peak hours, and customer preferences.
              </p>
              <ul className="text-sm text-gray-500 space-y-2" aria-label="Analytics features">
                <li>• Sales performance tracking</li>
                <li>• Menu optimization insights</li>
                <li>• Customer behavior analysis</li>
              </ul>
            </article>

            {/* Restaurant Benefit 3 */}
            <article className="bg-white rounded-xl shadow-lg p-8 border-l-4 border-red-600 hover:shadow-xl transition-shadow" role="listitem">
              <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-6" aria-hidden="true">
                <Users className="text-red-600" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-black mb-4">Reduce Staff Costs</h3>
              <p className="text-gray-600 mb-4">
                Automate order taking and payment processing, allowing your staff to focus on 
                food preparation and customer service.
              </p>
              <ul className="text-sm text-gray-500 space-y-2" aria-label="Staff cost reduction features">
                <li>• Automated order management</li>
                <li>• Reduced training requirements</li>
                <li>• Optimized staff allocation</li>
              </ul>
            </article>

            {/* Restaurant Benefit 4 */}
            <article className="bg-white rounded-xl shadow-lg p-8 border-l-4 border-red-600 hover:shadow-xl transition-shadow" role="listitem">
              <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-6" aria-hidden="true">
                <CreditCard className="text-red-600" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-black mb-4">Seamless Payments</h3>
              <p className="text-gray-600 mb-4">
                Accept UPI, cards, and cash payments with automatic reconciliation and 
                detailed transaction reporting.
              </p>
              <ul className="text-sm text-gray-500 space-y-2" aria-label="Payment features">
                <li>• Multiple payment options</li>
                <li>• Instant payment confirmation</li>
                <li>• Automated accounting</li>
              </ul>
            </article>

            {/* Restaurant Benefit 5 */}
            <article className="bg-white rounded-xl shadow-lg p-8 border-l-4 border-red-600 hover:shadow-xl transition-shadow" role="listitem">
              <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-6" aria-hidden="true">
                <Shield className="text-red-600" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-black mb-4">Contactless & Safe</h3>
              <p className="text-gray-600 mb-4">
                Provide a completely contactless dining experience that customers love and 
                meets all health and safety requirements.
              </p>
              <ul className="text-sm text-gray-500 space-y-2" aria-label="Safety features">
                <li>• Zero physical contact</li>
                <li>• Digital menu updates</li>
                <li>• Hygienic operations</li>
              </ul>
            </article>

            {/* Restaurant Benefit 6 */}
            <article className="bg-white rounded-xl shadow-lg p-8 border-l-4 border-red-600 hover:shadow-xl transition-shadow" role="listitem">
              <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-6" aria-hidden="true">
                <Zap className="text-red-600" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-black mb-4">Quick Setup</h3>
              <p className="text-gray-600 mb-4">
                Get started in minutes with our easy setup process. No complex hardware 
                or lengthy training required.
              </p>
              <ul className="text-sm text-gray-500 space-y-2" aria-label="Setup features">
                <li>• 5-minute setup process</li>
                <li>• No additional hardware</li>
                <li>• Instant QR code generation</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      {/* Benefits for Customers Section */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-black mb-6">
              Exceptional Customer Experience
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Delight your customers with a modern, convenient, and personalized dining experience 
              that keeps them coming back.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Customer Benefits List */}
            <div className="space-y-8">
              <div className="flex items-start space-x-4">
                <div className="bg-red-600 text-white p-3 rounded-full flex-shrink-0">
                  <QrCode size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-black mb-2">Instant Ordering</h3>
                  <p className="text-gray-600">
                    Simply scan the QR code at your table to browse the menu and place orders instantly. 
                    No waiting for waiters or downloading apps.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-red-600 text-white p-3 rounded-full flex-shrink-0">
                  <Smartphone size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-black mb-2">Mobile Payments</h3>
                  <p className="text-gray-600">
                    Pay seamlessly with UPI, cards, or cash. Secure transactions with instant 
                    confirmation and digital receipts.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-red-600 text-white p-3 rounded-full flex-shrink-0">
                  <Clock size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-black mb-2">Real-Time Updates</h3>
                  <p className="text-gray-600">
                    Get live updates on your order status. Know exactly when your food is being 
                    prepared and when it will be served.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-red-600 text-white p-3 rounded-full flex-shrink-0">
                  <CheckCircle size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-black mb-2">Order Accuracy</h3>
                  <p className="text-gray-600">
                    Eliminate miscommunication with digital ordering. Your order is exactly 
                    what you selected, every time.
                  </p>
                </div>
              </div>
            </div>

            {/* Visual Element */}
            <div className="bg-gradient-to-br from-red-50 to-gray-100 rounded-2xl p-8 text-center">
              <div className="bg-white rounded-xl p-8 shadow-lg">
                <QrCode size={120} className="text-red-600 mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-black mb-4">Scan & Order</h3>
                <p className="text-gray-600 mb-6">
                  Experience the future of dining with our QR code technology
                </p>
                <div className="flex justify-center space-x-4">
                  <div className="bg-red-100 text-red-600 px-4 py-2 rounded-full text-sm font-semibold">
                    No App Required
                  </div>
                  <div className="bg-red-100 text-red-600 px-4 py-2 rounded-full text-sm font-semibold">
                    Instant Access
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Plans Section */}
      <section id="pricing" className="py-20 bg-gradient-to-br from-gray-50 via-white to-gray-100" aria-labelledby="pricing-heading">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-block bg-red-100 text-red-600 px-6 py-2 rounded-full text-sm font-semibold mb-6">
              💰 Transparent Pricing
            </div>
            <h2 id="pricing-heading" className="text-4xl sm:text-5xl font-bold text-black mb-6 bg-gradient-to-r from-black to-red-600 bg-clip-text text-transparent">
              WaitNot Pricing Plans
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Choose the perfect plan for your restaurant. Start small and scale as you grow. 
              All plans include our core QR technology and dedicated support.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Starter Plan */}
            <div className="bg-white rounded-3xl shadow-xl border border-gray-200 p-8 relative hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 group">
              {/* Plan Header */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-bold mb-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  Starter Plan
                </div>
                <div className="mb-4">
                  <div className="flex items-baseline justify-center gap-2 mb-2">
                    <span className="text-5xl font-bold text-black">₹99</span>
                    <span className="text-gray-500 text-lg">/ month</span>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                    <div className="text-green-700 font-semibold text-sm">
                      ₹999 / year
                    </div>
                    <div className="text-green-600 text-xs">
                      Save ₹189 – 2 months FREE! 🎉
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                    Perfect for: Small cafés, food stalls & new restaurants
                  </p>
                </div>
              </div>

              {/* Features */}
              <div className="mb-8">
                <h4 className="font-bold text-black mb-4 flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                  What's Included
                </h4>
                <ul className="space-y-3">
                  {[
                    "Scan & View Digital Menu (QR based)",
                    "Edit Menu Anytime (items, price, availability)",
                    "Total Menu Views Count",
                    "Basic Dashboard Access",
                    "Mobile-Friendly Menu Page"
                  ].map((feature, index) => (
                    <li key={index} className="flex items-start gap-3 group-hover:translate-x-1 transition-transform duration-200">
                      <div className="bg-green-100 rounded-full p-1 mt-0.5">
                        <Check size={12} className="text-green-600" />
                      </div>
                      <span className="text-gray-700 text-sm leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>

                <h4 className="font-bold text-black mb-4 mt-6 flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                  Not Included
                </h4>
                <ul className="space-y-3">
                  {[
                    "Order placement",
                    "Online payments",
                    "Reports & analytics",
                    "POS / KOT printing",
                    "AI ordering assistant"
                  ].map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="bg-red-100 rounded-full p-1 mt-0.5">
                        <Minus size={12} className="text-red-500" />
                      </div>
                      <span className="text-gray-500 text-sm leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button 
                onClick={() => {
                  trackPricingEvent('click', 'Starter Plan', 99);
                  openWhatsApp('Starter_Plan_99');
                }}
                className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-4 rounded-xl font-bold transition-all transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                Get Started for ₹99
              </button>
            </div>

            {/* Pro Plan - Most Popular */}
            <div className="bg-white rounded-3xl shadow-2xl border-2 border-red-500 p-8 relative transform scale-105 hover:scale-110 transition-all duration-300 group">
              {/* Most Popular Badge */}
              <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 z-10">
                <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-8 py-3 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg">
                  <Star size={16} fill="currentColor" className="animate-pulse" />
                  Most Popular
                </div>
              </div>
              
              {/* Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-red-600/20 rounded-3xl blur-xl -z-10"></div>
              
              {/* Plan Header */}
              <div className="text-center mb-6 mt-4">
                <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-full text-sm font-bold mb-4">
                  <Star size={16} className="text-red-600" fill="currentColor" />
                  Pro Plan
                </div>
                <div className="mb-4">
                  <div className="flex items-baseline justify-center gap-2 mb-2">
                    <span className="text-5xl font-bold bg-gradient-to-r from-red-600 to-black bg-clip-text text-transparent">₹2,999</span>
                    <span className="text-gray-500 text-lg">/ month</span>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                    <div className="text-red-700 font-semibold text-sm">
                      ₹29,999 / year
                    </div>
                    <div className="text-red-600 text-xs">
                      Save ₹5,989 – 2 months FREE! 🔥
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 bg-red-50 rounded-lg p-3 border border-red-100">
                    Perfect for most dine-in restaurants & cafés
                  </p>
                </div>
              </div>

              {/* Features */}
              <div className="mb-8">
                <h4 className="font-bold text-black mb-4 flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                  Premium Features
                </h4>
                <ul className="space-y-3">
                  {[
                    "Unlimited QR Orders",
                    "Full Table Order Management",
                    "Kitchen Order Ticket (KOT)",
                    "Online Payments (UPI / Cards)",
                    "Sales Reports (Daily / Monthly)",
                    "Customer Order History",
                    "WhatsApp Order Notifications",
                    "Basic POS Dashboard"
                  ].map((feature, index) => (
                    <li key={index} className="flex items-start gap-3 group-hover:translate-x-1 transition-transform duration-200">
                      <div className="bg-green-100 rounded-full p-1 mt-0.5">
                        <Check size={12} className="text-green-600" />
                      </div>
                      <span className="text-gray-700 text-sm leading-relaxed font-medium">{feature}</span>
                    </li>
                  ))}
                  {[
                    "Inventory management",
                    "Multi-branch support"
                  ].map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="bg-red-100 rounded-full p-1 mt-0.5">
                        <Minus size={12} className="text-red-500" />
                      </div>
                      <span className="text-gray-500 text-sm leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button 
                onClick={() => {
                  trackPricingEvent('click', 'Pro Plan', 2999);
                  openWhatsApp('Pro_Plan_2999');
                }}
                className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white py-4 rounded-xl font-bold transition-all transform hover:scale-105 shadow-xl hover:shadow-2xl relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
                <span className="relative flex items-center justify-center gap-2">
                  👉 Best Value Plan – Get Started
                </span>
              </button>
            </div>

            {/* Premium POS Plan */}
            <div className="bg-gradient-to-br from-black to-gray-900 rounded-3xl shadow-xl border border-gray-700 p-8 relative hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 group text-white">
              {/* Plan Header */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 bg-purple-900/50 text-purple-300 px-4 py-2 rounded-full text-sm font-bold mb-4 border border-purple-500/30">
                  <div className="text-2xl">🚀</div>
                  Premium POS Plan
                </div>
                <div className="mb-4">
                  <div className="flex items-baseline justify-center gap-2 mb-2">
                    <span className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-white bg-clip-text text-transparent">₹6,999</span>
                    <span className="text-gray-400 text-lg">/ month</span>
                  </div>
                  <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-3 mb-3">
                    <div className="text-purple-300 font-semibold text-sm">
                      ₹69,999 / year
                    </div>
                    <div className="text-purple-400 text-xs">
                      Save ₹13,989 – Enterprise Savings! 💎
                    </div>
                  </div>
                  <p className="text-sm text-gray-300 bg-gray-800/50 rounded-lg p-3 border border-gray-600">
                    For established restaurants & chains
                  </p>
                </div>
              </div>

              {/* Features */}
              <div className="mb-8">
                <h4 className="font-bold text-white mb-4 flex items-center gap-2">
                  <div className="w-4 h-4 bg-purple-500 rounded-full animate-pulse"></div>
                  Enterprise Features
                </h4>
                <ul className="space-y-3">
                  {[
                    "Everything in Pro Plan",
                    "Full POS System",
                    "Inventory Management",
                    "Staff & Role Management",
                    "Multi-Branch Support",
                    "Advanced Analytics",
                    "Priority Support",
                    "Custom Feature Requests",
                    "Thermal Printer Integration"
                  ].map((feature, index) => (
                    <li key={index} className="flex items-start gap-3 group-hover:translate-x-1 transition-transform duration-200">
                      <div className="bg-purple-900/50 rounded-full p-1 mt-0.5 border border-purple-500/30">
                        <Check size={12} className="text-purple-400" />
                      </div>
                      <span className="text-gray-300 text-sm leading-relaxed font-medium">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button 
                onClick={() => {
                  trackPricingEvent('click', 'Premium Plan', 6999);
                  openWhatsApp('Premium_Plan_6999');
                }}
                className="w-full bg-gradient-to-r from-purple-600 to-black hover:from-purple-700 hover:to-gray-900 text-white py-4 rounded-xl font-bold transition-all transform hover:scale-105 shadow-xl hover:shadow-2xl border border-purple-500/30 flex items-center justify-center gap-2"
              >
                <div className="text-xl">🚀</div>
                Get Premium Plan
              </button>
            </div>
          </div>

          {/* Enhanced Pricing Footer */}
          <div className="text-center mt-16">
            <div className="bg-white rounded-2xl shadow-lg p-8 max-w-4xl mx-auto border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div>
                  <h3 className="text-2xl font-bold text-black mb-4">
                    🎯 Why Choose WaitNot?
                  </h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    All plans include free setup, training, and 24/7 customer support. 
                    Start your digital transformation today with zero risk.
                  </p>
                  <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                    <div className="bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2">
                      <Check size={16} />
                      No hidden fees
                    </div>
                    <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2">
                      <Check size={16} />
                      Cancel anytime
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-500 text-white rounded-full p-2">
                        <Shield size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-green-800">30-Day Money-Back Guarantee</div>
                        <div className="text-green-600 text-sm">Risk-free trial period</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-500 text-white rounded-full p-2">
                        <Users size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-blue-800">Free Migration Assistance</div>
                        <div className="text-blue-600 text-sm">We'll help you switch seamlessly</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Trust Indicators */}
            <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              <div className="text-center">
                <div className="bg-red-100 text-red-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Clock size={24} />
                </div>
                <div className="font-bold text-black">5 Min</div>
                <div className="text-gray-600 text-sm">Setup Time</div>
              </div>
              <div className="text-center">
                <div className="bg-green-100 text-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Shield size={24} />
                </div>
                <div className="font-bold text-black">99.9%</div>
                <div className="text-gray-600 text-sm">Uptime SLA</div>
              </div>
              <div className="text-center">
                <div className="bg-blue-100 text-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users size={24} />
                </div>
                <div className="font-bold text-black">24/7</div>
                <div className="text-gray-600 text-sm">Support</div>
              </div>
              <div className="text-center">
                <div className="bg-purple-100 text-purple-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                  <TrendingUp size={24} />
                </div>
                <div className="font-bold text-black">500+</div>
                <div className="text-gray-600 text-sm">Happy Clients</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <div className="py-20 bg-black text-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              How It Works
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Get started in just 3 simple steps and transform your restaurant operations today
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="text-center">
              <div className="bg-red-600 text-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold">
                1
              </div>
              <h3 className="text-2xl font-bold mb-4">Setup Your Restaurant</h3>
              <p className="text-gray-300 leading-relaxed">
                Create your account, add your menu items, and customize your restaurant profile. 
                Generate QR codes for your tables in minutes.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="bg-red-600 text-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold">
                2
              </div>
              <h3 className="text-2xl font-bold mb-4">Customers Scan & Order</h3>
              <p className="text-gray-300 leading-relaxed">
                Customers scan the QR code at their table, browse your menu, and place orders 
                directly from their phones. No app downloads required.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="bg-red-600 text-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold">
                3
              </div>
              <h3 className="text-2xl font-bold mb-4">Manage & Grow</h3>
              <p className="text-gray-300 leading-relaxed">
                Receive orders instantly, track performance with analytics, and grow your business 
                with data-driven insights and improved efficiency.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Section */}
      <div className="py-20 bg-red-600 text-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl sm:text-5xl font-bold mb-2">500+</div>
              <div className="text-red-100 text-lg">Restaurants</div>
            </div>
            <div>
              <div className="text-4xl sm:text-5xl font-bold mb-2">50K+</div>
              <div className="text-red-100 text-lg">Orders Processed</div>
            </div>
            <div>
              <div className="text-4xl sm:text-5xl font-bold mb-2">35%</div>
              <div className="text-red-100 text-lg">Revenue Increase</div>
            </div>
            <div>
              <div className="text-4xl sm:text-5xl font-bold mb-2">99.9%</div>
              <div className="text-red-100 text-lg">Uptime</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div id="cta-section" className="py-20 bg-gradient-to-r from-black to-red-900 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            Ready to Transform Your Restaurant?
          </h2>
          <p className="text-xl mb-8 text-gray-200 leading-relaxed">
            Join hundreds of successful restaurants using WaitNot to increase revenue, 
            reduce costs, and delight customers every day.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-8">
            <button 
              onClick={() => {
                trackEvent('click', 'CTA', 'Start_Free_Trial_Main');
                openWhatsApp('Main_CTA_Free_Trial');
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-10 py-4 rounded-lg font-bold text-lg transition-all transform hover:scale-105 shadow-lg"
            >
              Start Free Trial
            </button>
            <button 
              onClick={() => setShowScheduleModal(true)}
              className="border-2 border-white text-white hover:bg-white hover:text-black px-10 py-4 rounded-lg font-bold text-lg transition-all"
            >
              Schedule Demo
            </button>
          </div>
          
          <p className="text-gray-300 text-sm">
            No setup fees • 30-day free trial • Cancel anytime
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-black text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <h3 className="text-3xl font-bold mb-4">
                <span className="text-white">Wait</span><span className="text-red-500">Not</span>
              </h3>
              <p className="text-gray-300 mb-6 leading-relaxed">
                Revolutionizing the restaurant industry with innovative QR-based ordering 
                and payment solutions. Helping restaurants increase efficiency, reduce costs, 
                and provide exceptional customer experiences.
              </p>
              <div className="flex space-x-4">
                <div className="bg-red-600 text-white px-4 py-2 rounded-full text-sm font-semibold">
                  Trusted by 500+ Restaurants
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4 text-red-400">Features</h4>
              <ul className="space-y-3 text-gray-300">
                <li>QR Code Ordering</li>
                <li>Real-time Analytics</li>
                <li>Mobile Payments</li>
                <li>Order Management</li>
                <li>Customer Insights</li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4 text-red-400">Benefits</h4>
              <ul className="space-y-3 text-gray-300">
                <li>Increase Revenue</li>
                <li>Reduce Costs</li>
                <li>Improve Efficiency</li>
                <li>Contactless Service</li>
                <li>Better Customer Experience</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>&copy; 2024 WaitNot. All rights reserved. Transforming restaurants, one QR code at a time.</p>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showDemoModal && <DemoModal />}
      {showScheduleModal && <ScheduleModal />}
    </div>
    </>
  );
}