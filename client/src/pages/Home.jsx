import { useState } from 'react';
import { QrCode, Smartphone, Clock, TrendingUp, Shield, Zap, BarChart3, CreditCard, Bell, Users, CheckCircle, ArrowRight, Star, MapPin } from 'lucide-react';

export default function Home() {
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
              <button className="bg-red-600 hover:bg-red-700 text-white px-10 py-4 rounded-lg font-bold text-lg transition-all transform hover:scale-105 shadow-lg">
                Get Started Today
              </button>
              <button className="border-2 border-white text-white hover:bg-white hover:text-black px-10 py-4 rounded-lg font-bold text-lg transition-all">
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
      <div className="py-20 bg-gradient-to-r from-black to-red-900 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            Ready to Transform Your Restaurant?
          </h2>
          <p className="text-xl mb-8 text-gray-200 leading-relaxed">
            Join hundreds of successful restaurants using WaitNot to increase revenue, 
            reduce costs, and delight customers every day.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-8">
            <button className="bg-red-600 hover:bg-red-700 text-white px-10 py-4 rounded-lg font-bold text-lg transition-all transform hover:scale-105 shadow-lg">
              Start Free Trial
            </button>
            <button className="border-2 border-white text-white hover:bg-white hover:text-black px-10 py-4 rounded-lg font-bold text-lg transition-all">
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
    </div>
  );
}