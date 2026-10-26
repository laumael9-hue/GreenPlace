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
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#040806] text-white">
      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-32 w-[560px] h-[560px] bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[700px] h-[700px] bg-emerald-400/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,197,94,0.08)_0%,transparent_60%)]" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-28">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-6 items-center">
          {/* Copy */}
          <div className="lg:col-span-7 text-center lg:text-left">
            <p className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium tracking-wide text-primary-300 uppercase mb-6">
              <span className="w-8 h-px bg-primary-400" />
              Metro Cebu's sustainability platform
            </p>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-extrabold tracking-tight leading-[0.98]">
              Sustainable
              <br />
              living,{' '}
              <span className="bg-gradient-to-r from-primary-400 via-emerald-300 to-lime-300 bg-clip-text text-transparent">
                made simple.
              </span>
            </h1>

            <p className="mt-6 text-base sm:text-lg text-white/65 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Find waste management establishments, trade recyclable materials, and join a community
              making Metro Cebu greener.
            </p>

            <form
              onSubmit={handleSearch}
              className="mt-9 flex items-center gap-2 max-w-lg mx-auto lg:mx-0 bg-white/5 border border-white/20 rounded-full pl-5 pr-1.5 py-1.5 backdrop-blur-sm focus-within:border-primary-400/70 focus-within:bg-white/10 transition-colors"
            >
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search recyclables, products, materials..."
                aria-label="Search the marketplace"
                className="flex-1 min-w-0 bg-transparent text-white placeholder-white/40 text-sm sm:text-base focus:outline-none py-2"
              />
              <button
                type="submit"
                aria-label="Search"
                className="shrink-0 w-10 h-10 rounded-full bg-primary-500 text-gray-950 flex items-center justify-center hover:bg-primary-400 transition-colors"
              >
                <Search className="w-5 h-5" />
              </button>
            </form>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
              <Link
                to="/register"
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary-500 text-gray-950 font-semibold px-7 py-3 rounded-full hover:bg-primary-400 transition-colors shadow-lg shadow-primary-500/20"
              >
                Get started free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                to="/establishments"
                className="w-full sm:w-auto inline-flex items-center justify-center border border-white/25 text-white font-medium px-7 py-3 rounded-full hover:bg-white/10 transition-colors"
              >
                Find establishments
              </Link>
            </div>

            <ul className="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-3 text-sm text-white/55">
              <li className="flex items-center gap-2"><MapPin className="w-4 h-4 text-primary-400" /> Map of local drop-off points</li>
              <li className="flex items-center gap-2"><Recycle className="w-4 h-4 text-primary-400" /> Recyclables marketplace</li>
              <li className="flex items-center gap-2"><Users className="w-4 h-4 text-primary-400" /> Community forum</li>
            </ul>
          </div>

          {/* Art + photo */}
          <div className="lg:col-span-5 relative h-[360px] sm:h-[460px] lg:h-[600px]">
            <div className="absolute inset-[-18%] animate-[spin_160s_linear_infinite] opacity-90">
              <ContourArt className="w-full h-full" />
            </div>
            {/* Photo: black edges are faded out so it melts into the page */}
            <img
              src="/images/hero-leaves.jpg"
              alt="Hands cradling a green plant"
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                WebkitMaskImage: 'radial-gradient(ellipse 62% 56% at 50% 50%, #000 40%, transparent 100%)',
                maskImage: 'radial-gradient(ellipse 62% 56% at 50% 50%, #000 40%, transparent 100%)',
              }}
            />
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
      <p className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium tracking-wide text-primary-300 uppercase mb-4">
        <span className="w-8 h-px bg-primary-400" />
        {eyebrow}
        <span className="w-8 h-px bg-primary-400" />
      </p>
      <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
        {title}
        <br />
        <span className="bg-gradient-to-r from-primary-400 via-emerald-300 to-lime-300 bg-clip-text text-transparent">{highlight}</span>
      </h2>
      {subtitle && <p className="mt-5 text-lg text-white/60 max-w-2xl mx-auto">{subtitle}</p>}
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
    <section id="features" ref={ref} className="relative py-28 bg-[#040806] text-white overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-400/40 to-transparent" />
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-primary-500/10 blur-3xl rounded-full pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Features"
          title="Everything you need for"
          highlight="sustainable living"
          subtitle="One platform for waste management, recycling, and building a greener Metro Cebu."
          isVisible={isVisible}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`group p-7 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-primary-400/40 transition-all duration-500 hover:-translate-y-1 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${index * 90}ms` }}
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-500/10 text-primary-300 ring-1 ring-primary-400/20 mb-5 group-hover:bg-primary-500/20 transition-colors">
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-white/55 leading-relaxed">{feature.description}</p>
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
    <section id="how-it-works" ref={ref} className="relative py-28 bg-[#060c08] text-white overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader eyebrow="How it works" title="Three simple steps to" highlight="start recycling" isVisible={isVisible} />

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className={`relative p-8 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.01] transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${index * 160}ms` }}
            >
              <span className="absolute top-6 right-7 text-6xl font-extrabold tracking-tight text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.14)]">
                {step.number}
              </span>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-400 to-emerald-500 flex items-center justify-center text-gray-950 shadow-lg shadow-primary-500/20 mb-6">
                <step.icon className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-semibold mb-3">{step.title}</h3>
              <p className="text-white/55 leading-relaxed">{step.description}</p>
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
    <section ref={ref} className="relative py-28 bg-[#040806] text-white overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader eyebrow="Built for everyone" title="One platform," highlight="three ways to help" isVisible={isVisible} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {audiences.map((a, index) => (
            <div
              key={a.title}
              className={`p-7 rounded-2xl border border-white/10 bg-white/[0.03] transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${index * 140}ms` }}
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-500/10 text-primary-300 ring-1 ring-primary-400/20 mb-5">
                <a.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-4">{a.title}</h3>
              <ul className="space-y-3">
                {a.points.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-white/60">
                    <CheckCircle2 className="w-5 h-5 text-primary-400 shrink-0 mt-0.5" />
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
    <section ref={ref} className="relative py-24 bg-[#040806] text-white overflow-hidden">
      <div className={`relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-primary-500 to-emerald-400 px-6 py-16 sm:px-16 sm:py-20 text-center shadow-2xl shadow-primary-500/20">
          <ContourArt className="absolute -right-24 -top-24 w-[520px] h-[520px] opacity-30 pointer-events-none mix-blend-overlay" />
          <ContourArt className="absolute -left-32 -bottom-40 w-[460px] h-[460px] opacity-20 pointer-events-none mix-blend-overlay" />
          <div className="relative">
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight text-gray-950">
              Ready to make a real impact?
            </h2>
            <p className="mt-5 text-lg text-gray-950/70 max-w-2xl mx-auto leading-relaxed">
              Join residents and businesses across Metro Cebu working together for a cleaner, greener future.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/register"
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gray-950 text-white font-semibold px-8 py-3.5 rounded-full hover:bg-gray-800 transition-colors"
              >
                Get started free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                to="/establishments"
                className="w-full sm:w-auto inline-flex items-center justify-center border border-gray-950/30 text-gray-950 font-medium px-8 py-3.5 rounded-full hover:bg-gray-950/10 transition-colors"
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
    <main className="bg-[#040806]">
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <AudienceSection />
      <CTASection />
    </main>
  );
}
