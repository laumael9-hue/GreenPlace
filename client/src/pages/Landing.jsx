import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Leaf, MapPin, ShoppingBag, Users, Shield, Recycle, ArrowRight, ChevronRight, Sparkles } from 'lucide-react';

// ============================================================
// INTERSECTION OBSERVER HOOK
// ============================================================

function useInView(options = {}) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.1, ...options });

    const el = ref.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [ref, isVisible];
}

// ============================================================
// ANIMATED COUNTER
// ============================================================

function AnimatedCounter({ end, suffix = '', duration = 2000 }) {
  const [count, setCount] = useState(0);
  const [ref, isVisible] = useInView();

  useEffect(() => {
    if (!isVisible) return;
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isVisible, end, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ============================================================
// HERO SECTION
// ============================================================

function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-500 to-emerald-500">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.15)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(16,185,129,0.3)_0%,transparent_50%)]" />
      </div>

      {/* Floating decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-[10%] w-72 h-72 bg-white/5 rounded-full blur-3xl animate-[float_8s_ease-in-out_infinite]" />
        <div className="absolute top-40 right-[15%] w-96 h-96 bg-emerald-300/10 rounded-full blur-3xl animate-[float_10s_ease-in-out_infinite_1s]" />
        <div className="absolute bottom-20 left-[20%] w-64 h-64 bg-white/5 rounded-full blur-2xl animate-[float_7s_ease-in-out_infinite_2s]" />
        <div className="absolute bottom-40 right-[10%] w-48 h-48 bg-emerald-200/10 rounded-full blur-2xl animate-[float_9s_ease-in-out_infinite_0.5s]" />

        {/* Floating leaf icons */}
        <Leaf className="absolute top-[15%] left-[8%] w-8 h-8 text-white/10 animate-[floatSpin_12s_linear_infinite]" />
        <Leaf className="absolute top-[25%] right-[12%] w-6 h-6 text-white/10 animate-[floatSpin_15s_linear_infinite_2s]" />
        <Leaf className="absolute bottom-[30%] left-[15%] w-10 h-10 text-white/10 animate-[floatSpin_10s_linear_infinite_4s]" />
        <Leaf className="absolute bottom-[20%] right-[8%] w-5 h-5 text-white/10 animate-[floatSpin_14s_linear_infinite_1s]" />
        <Recycle className="absolute top-[60%] left-[5%] w-7 h-7 text-white/8 animate-[floatSpin_11s_linear_infinite_3s]" />
        <Sparkles className="absolute top-[10%] right-[25%] w-5 h-5 text-white/10 animate-[floatSpin_13s_linear_infinite_5s]" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-8">
          <Sparkles className="w-4 h-4 text-emerald-300" />
          <span className="text-sm font-medium text-white/90">Metro Cebu's #1 Sustainability Platform</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-tight">
          Sustainable Living
          <br />
          <span className="bg-gradient-to-r from-emerald-200 to-white bg-clip-text text-transparent">
            Made Simple
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-white/80 max-w-3xl mx-auto leading-relaxed">
          Connect with waste management establishments, buy and sell recyclable materials,
          and join a community dedicated to making Metro Cebu greener.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/register"
            className="group w-full sm:w-auto bg-white text-primary-700 px-8 py-4 rounded-xl font-bold hover:bg-emerald-50 transition-all duration-300 text-lg shadow-xl shadow-black/10 hover:shadow-2xl hover:-translate-y-0.5 flex items-center justify-center gap-2"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            to="/marketplace"
            className="w-full sm:w-auto bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white px-8 py-4 rounded-xl font-bold hover:bg-white/20 transition-all duration-300 text-lg flex items-center justify-center gap-2"
          >
            Browse Marketplace
          </Link>
        </div>

        {/* Stats row */}
        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
          {[
            { value: 500, suffix: '+', label: 'Establishments' },
            { value: 10, suffix: 'K+', label: 'Active Users' },
            { value: 50, suffix: '+', label: 'Tons Recycled' },
            { value: 40, suffix: '+', label: 'Barangays' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
              <div className="text-2xl sm:text-3xl font-extrabold text-white">
                <AnimatedCounter end={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-xs sm:text-sm text-white/70 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-50 to-transparent" />
    </section>
  );
}

// ============================================================
// STATS BAR
// ============================================================

function StatsBar() {
  const [ref, isVisible] = useInView();

  const stats = [
    { icon: MapPin, value: 500, suffix: '+', label: 'Eco Establishments', color: 'text-blue-500' },
    { icon: Users, value: 10000, suffix: '+', label: 'Community Members', color: 'text-purple-500' },
    { icon: Recycle, value: 50, suffix: 'T+', label: 'Materials Recycled', color: 'text-emerald-500' },
    { icon: Shield, value: 40, suffix: '+', label: 'Barangays Covered', color: 'text-amber-500' },
  ];

  return (
    <section ref={ref} className="relative -mt-12 z-20 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-6 sm:p-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gray-50 ${stat.color} mb-3`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                  <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// FEATURES SECTION
// ============================================================

function FeaturesSection() {
  const [ref, isVisible] = useInView();

  const features = [
    {
      icon: MapPin,
      title: 'Find Establishments',
      description: 'Locate nearby waste management facilities, recycling centers, and junk shops with interactive maps and smart filters.',
      gradient: 'from-blue-500 to-blue-600',
      bg: 'bg-blue-50',
    },
    {
      icon: Recycle,
      title: 'Material Exchange',
      description: 'Buy and sell recyclable materials through our marketplace. Turn waste into value for your community.',
      gradient: 'from-emerald-500 to-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      icon: ShoppingBag,
      title: 'Eco Marketplace',
      description: 'Discover upcycled products and sustainable goods from verified local businesses and artisans.',
      gradient: 'from-purple-500 to-purple-600',
      bg: 'bg-purple-50',
    },
    {
      icon: Users,
      title: 'Community Forum',
      description: 'Engage with fellow residents, share sustainability tips, and learn about eco-friendly practices.',
      gradient: 'from-amber-500 to-orange-500',
      bg: 'bg-amber-50',
    },
    {
      icon: Shield,
      title: 'Secure Transactions',
      description: 'Safe payment options including Cash on Pickup. Your transactions are protected and verified.',
      gradient: 'from-rose-500 to-rose-600',
      bg: 'bg-rose-50',
    },
    {
      icon: Leaf,
      title: 'Impact Tracking',
      description: 'Track your recycling contributions, view your environmental impact, and earn recognition.',
      gradient: 'from-teal-500 to-cyan-500',
      bg: 'bg-teal-50',
    },
  ];

  return (
    <section id="features" ref={ref} className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-block text-sm font-bold text-primary-600 uppercase tracking-wider mb-3">Features</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900">
            Everything You Need for
            <br />
            <span className="text-primary-600">Sustainable Living</span>
          </h2>
          <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
            A comprehensive platform for waste management, recycling, and building a greener Metro Cebu.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`group relative p-6 rounded-2xl border border-gray-100 hover:border-transparent hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500 hover:-translate-y-1 bg-white ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} text-white mb-5 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                <feature.icon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-primary-600 transition-colors">{feature.title}</h3>
              <p className="text-gray-500 leading-relaxed">{feature.description}</p>
              <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Learn more <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// HOW IT WORKS
// ============================================================

function HowItWorksSection() {
  const [ref, isVisible] = useInView();

  const steps = [
    {
      number: '01',
      title: 'Discover',
      description: 'Search for nearby waste management establishments that accept your materials. Filter by type, distance, and ratings.',
      icon: MapPin,
      color: 'from-blue-500 to-blue-600',
    },
    {
      number: '02',
      title: 'Transact',
      description: 'Schedule drop-offs, buy recyclable materials, or sell your items through our secure marketplace.',
      icon: ShoppingBag,
      color: 'from-emerald-500 to-emerald-600',
    },
    {
      number: '03',
      title: 'Impact',
      description: 'Track your contributions, earn recognition, and join a community making Metro Cebu greener every day.',
      icon: Leaf,
      color: 'from-purple-500 to-purple-600',
    },
  ];

  return (
    <section id="how-it-works" ref={ref} className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-block text-sm font-bold text-primary-600 uppercase tracking-wider mb-3">How It Works</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900">
            Three Simple Steps to
            <br />
            <span className="text-primary-600">Start Recycling</span>
          </h2>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Connector line (desktop only) */}
          <div className="hidden md:block absolute top-20 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-blue-200 via-emerald-200 to-purple-200" />

          {steps.map((step, index) => (
            <div
              key={step.title}
              className={`relative text-center transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${index * 200}ms` }}
            >
              <div className="relative inline-flex mb-6">
                {/* Pulse ring */}
                <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${step.color} opacity-20 animate-[pulse_3s_ease-in-out_infinite_${index}s`} style={{ transform: 'scale(1.4)' }} />
                <div className={`relative w-20 h-20 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center text-white shadow-xl`}>
                  <step.icon className="w-9 h-9" />
                </div>
              </div>

              <div className="inline-block bg-gray-100 text-gray-500 text-xs font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-wider">
                Step {step.number}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
              <p className="text-gray-500 leading-relaxed max-w-xs mx-auto">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// TESTIMONIALS
// ============================================================

function TestimonialsSection() {
  const [ref, isVisible] = useInView();

  const testimonials = [
    {
      name: 'Maria Santos',
      role: 'Resident, Cebu City',
      quote: 'GreenPlace made it so easy to find recycling centers near me. I never knew I could earn from my recyclables!',
      avatar: 'MS',
      color: 'bg-blue-500',
    },
    {
      name: 'EcoCycle Philippines',
      role: 'Recycling Business',
      quote: 'We\'ve connected with hundreds of customers through GreenPlace. Our pickup orders increased by 200%.',
      avatar: 'EC',
      color: 'bg-emerald-500',
    },
    {
      name: 'Juan Dela Cruz',
      role: 'Resident, Mandaue City',
      quote: 'The marketplace is amazing. I sold all my old electronics and bought upcycled furniture. Win-win!',
      avatar: 'JD',
      color: 'bg-purple-500',
    },
  ];

  return (
    <section ref={ref} className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-block text-sm font-bold text-primary-600 uppercase tracking-wider mb-3">Testimonials</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900">
            Loved by the
            <br />
            <span className="text-primary-600">Community</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((t, index) => (
            <div
              key={t.name}
              className={`relative p-6 rounded-2xl bg-gray-50 border border-gray-100 hover:shadow-lg transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              <div className="text-4xl text-primary-200 font-serif mb-4">&ldquo;</div>
              <p className="text-gray-600 leading-relaxed mb-6">{t.quote}</p>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${t.color} rounded-full flex items-center justify-center text-white text-sm font-bold`}>
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// CTA SECTION
// ============================================================

function CTASection() {
  const [ref, isVisible] = useInView();

  return (
    <section ref={ref} className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-500 to-emerald-500">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.1)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(16,185,129,0.2)_0%,transparent_50%)]" />
      </div>

      {/* Floating elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-[10%] w-64 h-64 bg-white/5 rounded-full blur-3xl animate-[float_8s_ease-in-out_infinite]" />
        <div className="absolute bottom-10 right-[10%] w-80 h-80 bg-emerald-300/10 rounded-full blur-3xl animate-[float_10s_ease-in-out_infinite_2s]" />
        <Leaf className="absolute top-[20%] left-[5%] w-8 h-8 text-white/10 animate-[floatSpin_12s_linear_infinite]" />
        <Leaf className="absolute bottom-[25%] right-[8%] w-6 h-6 text-white/10 animate-[floatSpin_10s_linear_infinite_3s]" />
      </div>

      <div className={`relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-8">
          <Sparkles className="w-4 h-4 text-emerald-200" />
          <span className="text-sm font-medium text-white/90">Join the Movement</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
          Ready to Make a
          <br />
          <span className="bg-gradient-to-r from-emerald-200 to-white bg-clip-text text-transparent">Real Impact?</span>
        </h2>
        <p className="mt-6 text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
          Join thousands of residents and businesses in Metro Cebu working together for a sustainable future. Every item recycled makes a difference.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/register"
            className="group w-full sm:w-auto bg-white text-primary-700 px-8 py-4 rounded-xl font-bold hover:bg-emerald-50 transition-all duration-300 text-lg shadow-xl shadow-black/10 hover:shadow-2xl hover:-translate-y-0.5 flex items-center justify-center gap-2"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            to="/establishments"
            className="w-full sm:w-auto bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white px-8 py-4 rounded-xl font-bold hover:bg-white/20 transition-all duration-300 text-lg flex items-center justify-center gap-2"
          >
            Find Establishments
          </Link>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// MAIN LANDING PAGE
// ============================================================

export default function Landing() {
  return (
    <main>
      <HeroSection />
      <StatsBar />
      <FeaturesSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <CTASection />
    </main>
  );
}
