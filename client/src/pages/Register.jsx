import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Building2, Check, ShoppingBag, MapPin, Users, User } from 'lucide-react';
import api from '../lib/api';
import { REQUIRED_DOCUMENTS, validateDocumentFile, uploadRequiredDocument } from '../lib/businessDocuments';
import { useAuth } from '../context/AuthContext';
import SocialLogin from '../components/ui/SocialLogin';
import Logo from '../components/ui/Logo';
import DocumentUploadField from '../components/business/DocumentUploadField';

const PASSWORD_MIN_LENGTH = 6;

const strengthMeta = (score) => {
  if (score <= 1) return { label: 'Weak', bar: 'bg-red-400', text: 'text-red-500' };
  if (score === 2) return { label: 'Fair', bar: 'bg-amber-400', text: 'text-amber-500' };
  return { label: 'Strong', bar: 'bg-green-500', text: 'text-green-600' };
};

const passwordScore = (password) => {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 3);
};

export default function Register() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [accountType, setAccountType] = useState('resident');
  const [businessName, setBusinessName] = useState('');
  const [docFiles, setDocFiles] = useState({});
  const [docsTouched, setDocsTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const isBusiness = accountType === 'business';

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const setDocFile = (type, file) => {
    setDocsTouched(true);
    setDocFiles((prev) => ({ ...prev, [type]: file }));
  };

  const docError = (type) => {
    const file = docFiles[type];
    if (file) return validateDocumentFile(file);
    return docsTouched ? 'This document is required.' : '';
  };

  const chosenCount = REQUIRED_DOCUMENTS.filter(({ type }) => docFiles[type] && !validateDocumentFile(docFiles[type])).length;
  const businessReady = !isBusiness
    || (businessName.trim().length > 0 && chosenCount === REQUIRED_DOCUMENTS.length);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match');
    }

    if (formData.password.length < PASSWORD_MIN_LENGTH) {
      return setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
    }

    if (formData.phone && !/^09\d{9}$/.test(formData.phone.replace(/\s-/g, ''))) {
      return setError('Enter a valid Philippine mobile number (09XXXXXXXXX)');
    }

    if (isBusiness && !businessName.trim()) {
      return setError('Business name is required');
    }

    if (!businessReady) {
      setDocsTouched(true);
      return setError('Upload all 3 required documents to register a business');
    }

    setLoading(true);
    try {
      const data = await register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: 'resident',
        phone: formData.phone ? formData.phone.replace(/\s-/g, '') : undefined,
        businessName: isBusiness ? businessName.trim() : undefined,
      });

      if (!isBusiness) {
        navigate('/');
        return;
      }

      if (!data.session) {
        navigate('/login');
        return;
      }

      // The account and its pending business now exist; attach the documents, then submit.
      // Anything that fails can be finished from the Pending Approval screen.
      const failed = [];
      for (const { type, label } of REQUIRED_DOCUMENTS) {
        setProgress(`Uploading ${label}...`);
        try {
          await uploadRequiredDocument(api, type, docFiles[type]);
        } catch {
          failed.push(label);
        }
      }

      if (failed.length === 0) {
        setProgress('Submitting for review...');
        try {
          await api.post('/business/submit-for-review');
        } catch {
          failed.push('submission for review');
        }
      }

      navigate('/pending-approval', {
        replace: true,
        state: failed.length
          ? { notice: `Your account was created, but this step did not finish: ${failed.join(', ')}. Please complete it below.` }
          : undefined,
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const score = passwordScore(formData.password);
  const strength = strengthMeta(score);
  const passwordsMatch = formData.confirmPassword && formData.password === formData.confirmPassword;

  const features = [
    { icon: ShoppingBag, title: 'Sustainable Marketplace', desc: 'Buy & sell recyclables from local businesses' },
    { icon: MapPin,      title: 'Drop-off Tracking',       desc: 'Find and track waste drop-off locations' },
    { icon: Users,       title: 'Eco Community',           desc: 'Forum and messaging for green advocates' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel — desktop only */}
      <div className="hidden md:flex md:w-1/2 lg:w-[55%] relative flex-col justify-between bg-primary-800 overflow-hidden p-10 lg:p-14">
        {/* Cebu City skyline photo (Unsplash, Pao Dayag) with brand tint */}
        <img src="/images/hero-cebu.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-primary-900/60 to-primary-800/40" />

        {/* Logo */}
        <Link to="/" className="relative flex items-center gap-3">
          <Logo tone="light" size="lg" />
        </Link>

        {/* Tagline + feature bullets */}
        <div className="relative">
          <h2 className="text-3xl lg:text-4xl font-bold text-white leading-tight">
            Join Metro Cebu's<br />Sustainability Platform
          </h2>
          <p className="mt-3 text-white/75 text-base">
            Connect with eco-friendly businesses, trade recyclables, and track your environmental impact.
          </p>
          <ul className="mt-8 space-y-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{title}</p>
                  <p className="text-white/65 text-xs">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative border-t border-white/20 pt-5 text-sm text-white/70">
          Making Metro Cebu greener, one drop-off at a time.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col justify-center py-12 px-6 sm:px-10 lg:px-16 bg-white overflow-y-auto">
        {/* Mobile-only logo */}
        <div className="flex md:hidden justify-center mb-8">
          <Link to="/" className="flex items-center gap-2">
            <Logo size="lg" />
          </Link>
        </div>

        <div className="max-w-sm w-full mx-auto">
          <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
          <p className="mt-1.5 text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
              Sign in
            </Link>
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div>
              <span className="block text-sm font-medium text-gray-700">I am registering as</span>
              <div className="mt-1 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Account type">
                {[
                  { value: 'resident', label: 'Resident', icon: User },
                  { value: 'business', label: 'Business', icon: Building2 },
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={accountType === value}
                    onClick={() => setAccountType(value)}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                      accountType === value
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
              {isBusiness && (
                <p className="mt-2 text-xs text-gray-500">
                  Waste management establishments are reviewed by our team. Upload your business
                  registration documents below. You can sign in right away, but your business tools
                  unlock only after approval.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">First name</label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm transition-colors"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">Last name</label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700">Email address</label>
              <input
                id="reg-email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Mobile number <span className="text-gray-400">(optional)</span>
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm transition-colors"
                placeholder="09XXXXXXXXX"
              />
            </div>

            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700">Password</label>
              <div className="mt-1 relative">
                <input
                  id="reg-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm pr-10 transition-colors"
                  placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {formData.password && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${strength.bar}`} style={{ width: `${(score / 3) * 100}%` }} />
                  </div>
                  <span className={`text-xs font-medium ${strength.text}`}>{strength.label}</span>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirm password</label>
              <div className="mt-1 relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`block w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm pr-10 transition-colors ${
                    passwordsMatch ? 'border-green-400' : 'border-gray-200'
                  }`}
                  placeholder="Re-enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordsMatch && (
                <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
                  <Check className="w-3 h-3" /> Passwords match
                </p>
              )}
            </div>

            {isBusiness && (
              <div className="space-y-4 pt-1">
                <div>
                  <label htmlFor="businessName" className="block text-sm font-medium text-gray-700">
                    Business name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="businessName"
                    name="businessName"
                    type="text"
                    required
                    maxLength={255}
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm transition-colors"
                    placeholder="e.g. Cebu Green Recyclers"
                  />
                </div>

                <div className="space-y-4">
                  <p className="text-sm font-medium text-gray-900">Required documents</p>
                  {REQUIRED_DOCUMENTS.map(({ type, label }) => (
                    <DocumentUploadField
                      key={type}
                      id={`doc-${type}`}
                      label={label}
                      file={docFiles[type] || null}
                      error={docError(type)}
                      onChange={(file) => setDocFile(type, file)}
                      onRemove={() => setDocFile(type, null)}
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              {isBusiness && !businessReady && (
                <p className="mb-2 text-center text-xs text-gray-500">
                  {businessName.trim() ? `${chosenCount} of ${REQUIRED_DOCUMENTS.length} documents chosen` : 'Enter your business name'}
                  {' '}— all 3 documents are required to continue.
                </p>
              )}
              <button
                type="submit"
                disabled={loading || !businessReady}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-full text-base font-semibold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (progress || 'Creating account...') : 'Create account'}
              </button>
            </div>
          </form>
          {/* Social sign-up can't collect the business documents */}
          {!isBusiness && <SocialLogin verb="Sign up" />}
        </div>
      </div>
    </div>
  );
}
