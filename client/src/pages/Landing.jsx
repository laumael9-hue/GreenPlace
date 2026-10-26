import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Leaf, MapPin, ShoppingBag, Users, Shield, ShieldCheck, Recycle, ArrowRight, Search, Home, Building2, CheckCircle2 } from 'lucide-react';
import ContourArt from '../components/landing/ContourArt';

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
// HERO SECTION
// ============================================================

function HeroSection() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/marketplace?search=${encodeURIComponent(q)}` : '/marketplace');
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-primary-600 via-primary-500 to-emerald-400 text-white">
      {/* Soft light and depth */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.22)_0%,transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(4,120,87,0.35)_0%,transparent_55%)]" />
        <div className="absolute -top-32 -left-24 w-[480px] h-[480px] bg-white/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-28">
        <div className="grid lg:grid-cols-12 gap-14 lg:gap-8 items-center">
          {/* Copy */}
          <div className="lg:col-span-7 text-center lg:text-left">
            <p className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold tracking-wide text-white/90 uppercase mb-6">
              <span className="w-8 h-px bg-white/70" />
              Metro Cebu's sustainability platform
            </p>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-extrabold tracking-tight leading-[0.98]">
              Sustainable
              <br />
              living,{' '}
              <span className="text-gray-950">made simple.</span>
            </h1>

            <p className="mt-6 text-base sm:text-lg text-white/85 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Find waste management establishments, trade recyclable materials, and join a community
              making Metro Cebu greener.
            </p>

            <form
              onSubmit={handleSearch}
              className="mt-9 flex items-center gap-2 max-w-lg mx-auto lg:mx-0 bg-white rounded-full pl-5 pr-1.5 py-1.5 shadow-xl shadow-primary-900/15"
            >
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search recyclables, products, materials..."
                aria-label="Search the marketplace"
                className="flex-1 min-w-0 bg-transparent text-gray-900 placeholder-gray-400 text-sm sm:text-base focus:outline-none py-2"
              />
              <button
                type="submit"
                aria-label="Search"
                className="shrink-0 w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 transition-colors"
              >
                <Search className="w-5 h-5" />
              </button>
            </form>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
              <Link
                to="/register"
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gray-950 text-white font-semibold px-7 py-3 rounded-full hover:bg-gray-800 transition-colors shadow-lg shadow-primary-900/20"
              >
                Get started free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                to="/establishments"
                className="w-full sm:w-auto inline-flex items-center justify-center border-2 border-white/70 text-white font-semibold px-7 py-3 rounded-full hover:bg-white hover:text-primary-700 transition-colors"
              >
                Find establishments
              </Link>
            </div>

            <ul className="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-3 text-sm text-white/85">
              <li className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Map of local drop-off points</li>
              <li className="flex items-center gap-2"><Recycle className="w-4 h-4" /> Recyclables marketplace</li>
              <li className="flex items-center gap-2"><Users className="w-4 h-4" /> Community forum</li>
            </ul>
          </div>

          {/* Line art + photo */}
          <div className="lg:col-span-5 relative flex justify-center">
            <div className="absolute inset-[-25%] pointer-events-none animate-[spin_180s_linear_infinite]">
              <ContourArt className="w-full h-full" />
            </div>
            <div className="relative w-full max-w-sm sm:max-w-md lg:max-w-none">
              <img
                src="/images/hero-cleanup.jpg"
                alt="Volunteers sorting trash into a bag on a beach"
                className="relative w-full aspect-[4/5] object-cover rounded-[2rem] shadow-2xl shadow-primary-900/30 ring-4 ring-white/80"
              />
              <div className="absolute -bottom-5 -left-3 sm:-left-6 flex items-center gap-3 bg-white text-gray-900 rounded-2xl shadow-xl px-4 py-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                  <Recycle className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">Segregate at the source</p>
                  <p className="text-xs text-gray-500">Compost · Waste · Recycle</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// SHARED SECTION HEADER
// ============================================================

function SectionHeader({ eyebrow, title, highlight, subtitle, isVisible }) {
  return (
    <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <p className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold tracking-wide text-primary-600 uppercase mb-4">
        <span className="w-8 h-px bg-primary-500" />
        {eyebrow}
        <span className="w-8 h-px bg-primary-500" />
      </p>
      <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] text-gray-900">
        {title}
        <br />
        <span className="bg-gradient-to-r from-primary-600 to-emerald-500 bg-clip-text text-transparent">{highlight}</span>
      </h2>
      {subtitle && <p className="mt-5 text-lg text-gray-500 max-w-2xl mx-auto">{subtitle}</p>}
    </div>
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
      description: 'Locate nearby waste management facilities, recycling centers, and junk shops on an interactive map with smart filters.',
    },
    {
      icon: Recycle,
      title: 'Material Exchange',
      description: 'Buy and sell recyclable materials through the marketplace. Turn waste into value for your community.',
    },
    {
      icon: ShoppingBag,
      title: 'Eco Marketplace',
      description: 'Discover upcycled products and sustainable goods from verified local businesses.',
    },
    {
      icon: Users,
      title: 'Community Forum',
      description: 'Share sustainability tips with fellow residents and learn eco-friendly practices together.',
    },
    {
      icon: Shield,
      title: 'Verified & Secure',
      description: 'Businesses are reviewed by moderators, and you can pay with cash on pickup or online in test mode.',
    },
    {
      icon: Leaf,
      title: 'Drop-off Tracking',
      description: 'Schedule drop-offs, follow their status, and keep a record of the materials you have recycled.',
    },
  ];

  return (
    <section id="features" ref={ref} className="py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Features"
          title="Everything you need for"
          highlight="sustainable living"
          subtitle="One platform for waste management, recycling, and building a greener Metro Cebu."
          isVisible={isVisible}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`group p-7 rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-xl hover:shadow-primary-900/5 hover:border-primary-300 transition-all duration-500 hover:-translate-y-1 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${index * 90}ms` }}
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-50 text-primary-600 ring-1 ring-primary-100 mb-5 group-hover:bg-primary-600 group-hover:text-white group-hover:ring-primary-600 transition-colors">
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-500 leading-relaxed">{feature.description}</p>
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
      description: 'Search for nearby establishments that accept your materials. Filter by type, location, and ratings.',
      icon: MapPin,
    },
    {
      number: '02',
      title: 'Transact',
      description: 'Schedule drop-offs, buy recyclable materials, or sell your items through the marketplace.',
      icon: ShoppingBag,
    },
    {
      number: '03',
      title: 'Impact',
      description: 'Follow your drop-offs, share what you learn, and join a community greening Metro Cebu.',
      icon: Leaf,
    },
  ];

  return (
    <section id="how-it-works" ref={ref} className="py-28 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader eyebrow="How it works" title="Three simple steps to" highlight="start recycling" isVisible={isVisible} />

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className={`relative p-8 rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${index * 160}ms` }}
            >
              <span className="absolute top-6 right-7 text-6xl font-extrabold tracking-tight text-transparent [-webkit-text-stroke:1px_rgba(22,163,74,0.35)]">
                {step.number}
              </span>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-primary-500/25 mb-6">
                <step.icon className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">{step.title}</h3>
              <p className="text-gray-500 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// BUILT FOR EVERYONE
// ============================================================

function AudienceSection() {
  const [ref, isVisible] = useInView();

  const audiences = [
    {
      icon: Home,
      title: 'Residents',
      points: ['Find drop-off points near you', 'Shop recyclables and eco products', 'Schedule and track your drop-offs', 'Join the community forum'],
    },
    {
      icon: Building2,
      title: 'Businesses',
      points: ['Create your establishment profile', 'List products in your own shop', 'Manage orders and incoming drop-offs', 'See reviews and analytics'],
    },
    {
      icon: ShieldCheck,
      title: 'Moderators',
      points: ['Review business registrations', 'Verify submitted documents', 'Moderate listings and the forum', 'Keep the platform trustworthy'],
    },
  ];

  return (
    <section ref={ref} className="py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader eyebrow="Built for everyone" title="One platform," highlight="three ways to help" isVisible={isVisible} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {audiences.map((a, index) => (
            <div
              key={a.title}
              className={`p-7 rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${index * 140}ms` }}
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-50 text-primary-600 ring-1 ring-primary-100 mb-5">
                <a.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">{a.title}</h3>
              <ul className="space-y-3">
                {a.points.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-gray-600">
                    <CheckCircle2 className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
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
    <section ref={ref} className="py-24 bg-gray-50">
      <div className={`relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-primary-500 to-emerald-400 px-6 py-16 sm:px-16 sm:py-20 text-center shadow-2xl shadow-primary-900/20">
          <ContourArt className="absolute -right-24 -top-24 w-[520px] h-[520px] opacity-40 pointer-events-none" />
          <ContourArt className="absolute -left-32 -bottom-40 w-[460px] h-[460px] opacity-30 pointer-events-none" />
          <div className="relative">
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight text-white">
              Ready to make a real impact?
            </h2>
            <p className="mt-5 text-lg text-white/85 max-w-2xl mx-auto leading-relaxed">
              Join residents and businesses across Metro Cebu working together for a cleaner, greener future.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/register"
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-primary-700 font-semibold px-8 py-3.5 rounded-full hover:bg-primary-50 transition-colors shadow-lg shadow-primary-900/15"
              >
                Get started free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                to="/establishments"
                className="w-full sm:w-auto inline-flex items-center justify-center border-2 border-white/70 text-white font-semibold px-8 py-3.5 rounded-full hover:bg-white hover:text-primary-700 transition-colors"
              >
                Find establishments
              </Link>
            </div>
          </div>
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
      <FeaturesSection />
      <HowItWorksSection />
      <AudienceSection />
      <CTASection />
    </main>
  );
}
