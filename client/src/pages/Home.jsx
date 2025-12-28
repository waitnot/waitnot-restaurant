import { useState } from 'react';
import { QrCode, Smartphone, Clock, TrendingUp, Shield, Zap, BarChart3, CreditCard, Bell, Users, CheckCircle, ArrowRight, Star, MapPin, Play, X } from 'lucide-react';

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
    const ctaSection = document.getElementById('cta-section');
    if (ctaSection) {
      ctaSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Open WhatsApp with pre-filled message
  const openWhatsApp = () => {
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
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-red-600 to-black text-white">
        <div className="max-w-7xl mx-auto px-4 py-20 sm:py-32">
          <div className="text-center">
            {/* Logo */}
            <div className="mb-8">
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold mb-4">
                <span className="text-white">Wait</span><span className="text-red-400">Not</span>
              </h1>
              <div className="w-24 h-1 bg-red-500 mx-auto"></div>
            </div>
            
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
              >
                Get Started Today
              </button>
              <button 
                onClick={() => setShowDemoModal(true)}
                className="border-2 border-white text-white hover:bg-white hover:text-black px-10 py-4 rounded-lg font-bold text-lg transition-all"
              >
                Watch Demo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits for Restaurants Section */}
      <div className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-black mb-6">
              Transform Your Restaurant Business
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Join hundreds of restaurants already using WaitNot to increase revenue, 
              reduce operational costs, and provide exceptional customer experiences.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Restaurant Benefit 1 */}
            <div className="bg-white rounded-xl shadow-lg p-8 border-l-4 border-red-600 hover:shadow-xl transition-shadow">
              <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-6">
                <TrendingUp className="text-red-600" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-black mb-4">Increase Revenue by 35%</h3>
              <p className="text-gray-600 mb-4">
                Faster table turnover, reduced wait times, and upselling opportunities through digital menus 
                lead to significant revenue growth.
              </p>
              <ul className="text-sm text-gray-500 space-y-2">
                <li>• Faster order processing</li>
                <li>• Higher order accuracy</li>
                <li>• Automated upselling suggestions</li>
              </ul>
            </div>

            {/* Restaurant Benefit 2 */}
            <div className="bg-white rounded-xl shadow-lg p-8 border-l-4 border-red-600 hover:shadow-xl transition-shadow">
              <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-6">
                <BarChart3 className="text-red-600" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-black mb-4">Real-Time Analytics</h3>
              <p className="text-gray-600 mb-4">
                Make data-driven decisions with comprehensive insights into sales, popular items, 
                peak hours, and customer preferences.
              </p>
              <ul className="text-sm text-gray-500 space-y-2">
                <li>• Sales performance tracking</li>
                <li>• Menu optimization insights</li>
                <li>• Customer behavior analysis</li>
              </ul>
            </div>

            {/* Restaurant Benefit 3 */}
            <div className="bg-white rounded-xl shadow-lg p-8 border-l-4 border-red-600 hover:shadow-xl transition-shadow">
              <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-6">
                <Users className="text-red-600" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-black mb-4">Reduce Staff Costs</h3>
              <p className="text-gray-600 mb-4">
                Automate order taking and payment processing, allowing your staff to focus on 
                food preparation and customer service.
              </p>
              <ul className="text-sm text-gray-500 space-y-2">
                <li>• Automated order management</li>
                <li>• Reduced training requirements</li>
                <li>• Optimized staff allocation</li>
              </ul>
            </div>

            {/* Restaurant Benefit 4 */}
            <div className="bg-white rounded-xl shadow-lg p-8 border-l-4 border-red-600 hover:shadow-xl transition-shadow">
              <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-6">
                <CreditCard className="text-red-600" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-black mb-4">Seamless Payments</h3>
              <p className="text-gray-600 mb-4">
                Accept UPI, cards, and cash payments with automatic reconciliation and 
                detailed transaction reporting.
              </p>
              <ul className="text-sm text-gray-500 space-y-2">
                <li>• Multiple payment options</li>
                <li>• Instant payment confirmation</li>
                <li>• Automated accounting</li>
              </ul>
            </div>

            {/* Restaurant Benefit 5 */}
            <div className="bg-white rounded-xl shadow-lg p-8 border-l-4 border-red-600 hover:shadow-xl transition-shadow">
              <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-6">
                <Shield className="text-red-600" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-black mb-4">Contactless & Safe</h3>
              <p className="text-gray-600 mb-4">
                Provide a completely contactless dining experience that customers love and 
                meets all health and safety requirements.
              </p>
              <ul className="text-sm text-gray-500 space-y-2">
                <li>• Zero physical contact</li>
                <li>• Digital menu updates</li>
                <li>• Hygienic operations</li>
              </ul>
            </div>

            {/* Restaurant Benefit 6 */}
            <div className="bg-white rounded-xl shadow-lg p-8 border-l-4 border-red-600 hover:shadow-xl transition-shadow">
              <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-6">
                <Zap className="text-red-600" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-black mb-4">Quick Setup</h3>
              <p className="text-gray-600 mb-4">
                Get started in minutes with our easy setup process. No complex hardware 
                or lengthy training required.
              </p>
              <ul className="text-sm text-gray-500 space-y-2">
                <li>• 5-minute setup process</li>
                <li>• No additional hardware</li>
                <li>• Instant QR code generation</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

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
              onClick={openWhatsApp}
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
  );
}