import { Leaf, Recycle, MapPin, ShoppingBag, Users, Shield } from 'lucide-react';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <Leaf className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">GreenPlace</span>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 hover:text-primary-600 transition-colors">Features</a>
              <a href="#how-it-works" className="text-gray-600 hover:text-primary-600 transition-colors">How It Works</a>
              <a href="/login" className="text-gray-600 hover:text-primary-600 transition-colors">Login</a>
              <a href="/register" className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">Get Started</a>
            </nav>
          </div>
        </div>
      </header>

      <main>
        <section className="relative bg-gradient-to-b from-primary-50 to-white py-20 sm:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight">
              Sustainable Living Made Simple
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
              GreenPlace connects Metro Cebu residents with waste management establishments, 
              recyclable marketplaces, and a community dedicated to proper waste segregation and recycling.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="/register" className="w-full sm:w-auto bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors text-lg">
                Join as Resident
              </a>
              <a href="/business/register" className="w-full sm:w-auto bg-white text-primary-600 border-2 border-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors text-lg">
                Register Business
              </a>
            </div>
          </div>
        </section>

        <section id="features" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Why Choose GreenPlace?</h2>
              <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
                A comprehensive platform for waste management, recycling, and sustainable living in Metro Cebu
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard icon={<MapPin className="w-6 h-6" />} title="Find Establishments" description="Locate nearby waste management facilities, recycling centers, and junk shops with interactive maps and filters." />
              <FeatureCard icon={<Recycle className="w-6 h-6" />} title="Material Exchange" description="Buy and sell recyclable materials through our marketplace. Turn waste into value." />
              <FeatureCard icon={<ShoppingBag className="w-6 h-6" />} title="Eco Marketplace" description="Discover upcycled products and sustainable goods from local businesses." />
              <FeatureCard icon={<Users className="w-6 h-6" />} title="Community Forum" description="Engage with fellow residents, share tips, and learn about sustainable practices." />
              <FeatureCard icon={<Shield className="w-6 h-6" />} title="Secure Transactions" description="Safe payment options including Cash on Pickup and PayMongo test mode for demonstrations." />
              <FeatureCard icon={<Leaf className="w-6 h-6" />} title="Drop-off Tracking" description="Track your recycling drop-offs, view history, and monitor your environmental impact." />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">How It Works</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <StepCard number="1" title="Discover" description="Search for nearby waste management establishments that accept your materials. Filter by material type, distance, and ratings." />
              <StepCard number="2" title="Transact" description="Schedule drop-offs or browse the marketplace for recyclable materials and eco-friendly products." />
              <StepCard number="3" title="Earn & Impact" description="Get paid for recyclables, track your contributions, and join a community making Metro Cebu greener." />
            </div>
          </div>
        </section>

        <section className="py-20 bg-primary-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">Ready to Make an Impact?</h2>
            <p className="text-primary-100 text-lg mb-10 max-w-2xl mx-auto">
              Join thousands of residents and businesses in Metro Cebu working together for a sustainable future.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="/register" className="w-full sm:w-auto bg-white text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors text-lg">
                Get Started Free
              </a>
              <a href="/business/register" className="w-full sm:w-auto bg-transparent border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors text-lg">
                Register Your Business
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                  <Leaf className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold">GreenPlace</span>
              </div>
              <p className="text-gray-400 text-sm">Promoting sustainable living in Metro Cebu through proper waste management and recycling.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Find Establishments</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Marketplace</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Community Forum</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Drop-off Tracking</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Connect</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Facebook</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Instagram</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Email Updates</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-gray-800 text-center text-sm text-gray-400">
            <p>&copy; 2024 GreenPlace. All rights reserved. | Capstone Project</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 hover:border-primary-200 hover:shadow-lg transition-all duration-300">
      <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600 mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description }) {
  return (
    <div className="relative text-center p-6">
      <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6">
        {number}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

export default App;