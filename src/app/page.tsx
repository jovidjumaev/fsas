'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import {
  GraduationCap,
  BookOpen,
  QrCode,
  Activity,
  Shield,
  BarChart3,
  ArrowRight,
  Zap,
  Users,
  Sparkles,
  Moon,
  Sun,
  Brain,
  MapPin
} from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const { user, userRole, loading } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check for saved dark mode preference
    const savedMode = localStorage.getItem('darkMode') === 'true';
    setIsDarkMode(savedMode);
    if (savedMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('darkMode', String(newMode));
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    if (!loading && user && userRole) {
      if (userRole === 'student') {
        router.push('/student/dashboard');
      } else if (userRole === 'professor') {
        router.push('/professor/dashboard');
      }
    }
  }, [user, userRole, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-200 via-gray-200 to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center relative overflow-hidden transition-colors duration-300">
        <div className="text-center relative z-10 animated-bg-content">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-300 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-700 dark:text-gray-300 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-200 via-gray-200 to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative overflow-hidden transition-colors duration-300">
      {/* Subtle Grid Pattern - Visible in both light and dark mode */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(to right, rgb(59 130 246 / 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(59 130 246 / 0.04) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          animation: 'gridMove 20s linear infinite'
        }}></div>
      </div>

      {/* Floating Glowing Orbs - Visible in both light and dark mode */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 -left-40 w-96 h-96 bg-blue-500/8 dark:bg-blue-400/12 rounded-full blur-3xl animate-float-orb-slow"></div>
        <div className="absolute -top-40 right-0 w-96 h-96 bg-cyan-500/8 dark:bg-cyan-400/12 rounded-full blur-3xl animate-float-orb-slow" style={{ animationDelay: '5s' }}></div>
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-blue-600/8 dark:bg-blue-400/12 rounded-full blur-3xl animate-float-orb-slow" style={{ animationDelay: '10s' }}></div>
      </div>

      {/* Gentle QR Pattern - Visible in both light and dark mode */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-20 grid grid-cols-3 gap-1 opacity-0 animate-qr-gentle" style={{ animationDelay: '0s' }}>
          {[...Array(9)].map((_, i) => (
            <div key={i} className={`w-3 h-3 ${[0,2,4,6,8].includes(i) ? 'bg-blue-600/15 dark:bg-blue-400/20' : 'bg-transparent'}`}></div>
          ))}
        </div>
      </div>

      {/* Slow Scanning Beam - Visible in both light and dark mode */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-blue-500/30 dark:via-blue-400/40 to-transparent animate-scan-slow"></div>
      </div>

      {/* Falling Geometric Figures - Visible in both light and dark mode */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Left side - Square */}
        <div className="absolute left-[15%] w-12 h-12 border-2 border-blue-500/40 dark:border-blue-400/50 bg-blue-500/5 dark:bg-blue-400/10 rounded-lg animate-fall-slow shadow-lg shadow-blue-500/20 dark:shadow-blue-400/30"></div>
        {/* Right side - Circle */}
        <div className="absolute right-[15%] w-12 h-12 border-2 border-blue-400/40 dark:border-blue-300/50 bg-blue-400/5 dark:bg-blue-300/10 rounded-full animate-fall-slow shadow-lg shadow-blue-400/20 dark:shadow-blue-300/30" style={{ animationDelay: '7.5s' }}></div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-gray-200/80 dark:border-gray-700/80 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl fixed top-0 left-0 right-0 z-50 shadow-sm dark:shadow-gray-800/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link href="/" className="flex items-center space-x-3 group cursor-pointer">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl blur-md opacity-50 group-hover:opacity-75 transition-opacity"></div>
                  <div className="relative w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent group-hover:from-blue-700 group-hover:to-cyan-700 transition-all">
                    FSAS
                  </h1>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Furman Smart Attendance System</p>
                </div>
              </Link>
              <div className="flex items-center space-x-4">
                {/* Dark Mode Toggle */}
                <button
                  onClick={toggleDarkMode}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Toggle dark mode"
                >
                  {isDarkMode ? (
                    <Sun className="w-5 h-5 text-yellow-500" />
                  ) : (
                    <Moon className="w-5 h-5 text-gray-700" />
                  )}
                </button>
                
                <Link 
                  href="#get-started" 
                  className="group relative inline-flex items-center justify-center px-6 py-2.5 overflow-hidden font-semibold text-white transition-all duration-300 ease-out bg-gradient-to-r from-blue-600 to-cyan-600 rounded-full hover:scale-105 hover:shadow-xl hover:shadow-blue-500/50"
                >
                  <span className="absolute right-0 w-8 h-32 -mt-12 transition-all duration-1000 transform translate-x-12 bg-white opacity-10 rotate-12 group-hover:-translate-x-40 ease"></span>
                  <span className="relative flex items-center space-x-2">
                    <span className="text-sm">Get Started</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto text-center">
            <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border border-blue-200 dark:border-blue-800 px-4 py-2 rounded-full mb-8">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">QR-Powered Attendance System</span>
            </div>
            
            <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black text-gray-900 dark:text-white mb-6 leading-none">
              Smart Attendance
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 dark:from-blue-400 dark:via-cyan-400 dark:to-blue-400 bg-clip-text text-transparent animate-gradient">
                AI-Powered Learning
              </span>
            </h1>

            <p className="text-xl text-gray-700 dark:text-gray-300 max-w-3xl mx-auto mb-16 leading-relaxed">
              The only attendance system that combines tamper-proof QR codes, geofencing security,
              AI study tools, and real-time analytics - trusted by Furman University
            </p>

            {/* Stats */}
            <div className="flex flex-wrap justify-center gap-12 mb-20">
              <div className="text-center group cursor-pointer">
                <div className="flex items-center justify-center mb-2">
                  <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400 mr-2 group-hover:scale-110 transition-transform" />
                  <div className="text-4xl font-black bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">10s</div>
                </div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Auto QR Refresh</div>
              </div>
              <div className="text-center group cursor-pointer">
                <div className="flex items-center justify-center mb-2">
                  <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-400 mr-2 group-hover:scale-110 transition-transform" />
                  <div className="text-4xl font-black bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">AI</div>
                </div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Study Assistant</div>
              </div>
              <div className="text-center group cursor-pointer">
                <div className="flex items-center justify-center mb-2">
                  <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400 mr-2 group-hover:scale-110 transition-transform" />
                  <div className="text-4xl font-black bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">Live</div>
                </div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Real-Time Updates</div>
              </div>
              <div className="text-center group cursor-pointer">
                <div className="flex items-center justify-center mb-2">
                  <QrCode className="w-6 h-6 text-blue-600 dark:text-blue-400 mr-2 group-hover:scale-110 transition-transform" />
                  <div className="text-4xl font-black bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">100m</div>
                </div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Geofencing Radius</div>
              </div>
            </div>
          </div>
        </section>

        {/* Portal Cards */}
        <section id="get-started" className="pb-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Student Portal */}
              <Link href="/student/login" className="group">
                <div className="relative h-full">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-3xl opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500"></div>
                  
                  <div className="relative h-full bg-white dark:bg-gray-800 rounded-3xl border-2 border-gray-100 dark:border-gray-700 p-10 group-hover:border-blue-300 dark:group-hover:border-blue-600 transition-all duration-300">
                    <div className="flex items-start justify-between mb-8">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-cyan-600 blur-2xl opacity-30 rounded-2xl"></div>
                        <div className="relative w-20 h-20 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                          <GraduationCap className="w-10 h-10 text-white" />
                        </div>
                      </div>
                      <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/30 rounded-full flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                        <ArrowRight className="w-6 h-6 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                    
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Student Portal</h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed text-lg">
                      Scan secure QR codes, access AI study tools, track attendance streaks, and get real-time notifications
                    </p>
                    
                    <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white h-14 text-base font-bold rounded-2xl shadow-xl shadow-blue-600/30 group-hover:shadow-2xl group-hover:shadow-blue-600/40 transition-all">
                      Sign In as Student
                    </Button>
                    
                    <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700 flex items-center justify-center space-x-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">New student?</span>
                      <Link href="/student/register" className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                        Create Account →
                      </Link>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Professor Portal */}
              <Link href="/professor/login" className="group">
                <div className="relative h-full">
                  <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-3xl opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500"></div>
                  
                  <div className="relative h-full bg-white dark:bg-gray-800 rounded-3xl border-2 border-gray-100 dark:border-gray-700 p-10 group-hover:border-cyan-300 dark:group-hover:border-cyan-600 transition-all duration-300">
                    <div className="flex items-start justify-between mb-8">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-600 to-blue-600 blur-2xl opacity-30 rounded-2xl"></div>
                        <div className="relative w-20 h-20 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                          <BookOpen className="w-10 h-10 text-white" />
                        </div>
                      </div>
                      <div className="w-12 h-12 bg-cyan-50 dark:bg-cyan-950/30 rounded-full flex items-center justify-center group-hover:bg-cyan-100 dark:group-hover:bg-cyan-900/50 transition-colors">
                        <ArrowRight className="w-6 h-6 text-cyan-600 dark:text-cyan-400 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                    
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Professor Portal</h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed text-lg">
                      Live attendance monitoring, tamper-proof QR codes, automatic session generation, and advanced analytics
                    </p>
                    
                    <Button className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white h-14 text-base font-bold rounded-2xl shadow-xl shadow-cyan-600/30 group-hover:shadow-2xl group-hover:shadow-cyan-600/40 transition-all">
                      Sign In as Professor
                    </Button>
                    
                    <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700 flex items-center justify-center space-x-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">New professor?</span>
                      <Link href="/professor/register" className="text-sm font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors">
                        Create Account →
                      </Link>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center space-x-2 bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900 px-4 py-2 rounded-full mb-6 shadow-sm">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">Why Choose FSAS</span>
              </div>
              <h2 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white mb-4">
                Enterprise-Grade Features
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                Military-grade security meets AI-powered learning in one unified platform
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: Shield,
                  title: "Secure QR Technology",
                  desc: "HMAC-SHA256 signatures refresh every 10 seconds to prevent fraud",
                  gradient: "from-blue-500 to-cyan-500"
                },
                {
                  icon: Brain,
                  title: "AI Study Assistant",
                  desc: "Generate flashcards, quizzes, and chat about course materials with GPT",
                  gradient: "from-cyan-500 to-blue-500"
                },
                {
                  icon: MapPin,
                  title: "GPS Geofencing",
                  desc: "100-meter radius validation ensures students are physically in class",
                  gradient: "from-blue-600 to-blue-500"
                },
                {
                  icon: Activity,
                  title: "WebSocket Live Updates",
                  desc: "Real-time attendance tracking with instant notifications",
                  gradient: "from-cyan-600 to-cyan-500"
                },
                {
                  icon: Zap,
                  title: "Instant Session Management",
                  desc: "Auto-generate semester schedules and manage sessions with one click",
                  gradient: "from-blue-500 to-cyan-600"
                },
                {
                  icon: BarChart3,
                  title: "Performance Analytics",
                  desc: "Track attendance streaks, quiz scores, and learning progress",
                  gradient: "from-cyan-500 to-blue-600"
                }
              ].map((feature, index) => (
                <div 
                  key={index} 
                  className="group relative"
                >
                  {/* Glow effect on hover */}
                  <div className={`absolute -inset-0.5 bg-gradient-to-r ${feature.gradient} rounded-2xl opacity-0 group-hover:opacity-20 blur transition-all duration-300`}></div>
                  
                  <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 group-hover:border-transparent group-hover:shadow-xl dark:group-hover:shadow-blue-500/20 transition-all duration-300">
                    <div className="flex items-start space-x-4 mb-4">
                      <div className={`relative shrink-0 w-14 h-14 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        <feature.icon className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {feature.title}
                        </h3>
                      </div>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                      {feature.desc}
                    </p>
                    
                    {/* Decorative element */}
                    <div className="absolute bottom-0 right-0 w-20 h-20 bg-gradient-to-br from-transparent to-blue-50 dark:to-blue-950/30 rounded-tl-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border border-blue-200 dark:border-blue-800 px-4 py-2 rounded-full mb-6">
                <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">Quick Setup</span>
              </div>
              <h2 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white mb-4">
                Get Started in 3 Steps
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                From zero to tracking attendance in less than a minute
              </p>
            </div>

            <div className="relative">
              {/* Connection line */}
              <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-200 via-cyan-200 to-blue-200 dark:from-blue-900 dark:via-cyan-900 dark:to-blue-900 -translate-y-1/2 z-0"></div>
              
              <div className="grid md:grid-cols-3 gap-8 relative z-10">
                {[
                  { 
                    num: "01", 
                    title: "Select Role", 
                    desc: "Choose Student or Professor portal based on your needs",
                    icon: Users,
                    gradient: "from-blue-500 to-cyan-500"
                  },
                  { 
                    num: "02", 
                    title: "Sign In", 
                    desc: "Access your account with secure authentication",
                    icon: Shield,
                    gradient: "from-cyan-500 to-blue-600"
                  },
                  { 
                    num: "03", 
                    title: "Start Tracking", 
                    desc: "Scan, monitor, and analyze attendance instantly",
                    icon: Zap,
                    gradient: "from-blue-600 to-cyan-600"
                  }
                ].map((step, index) => (
                  <div key={index} className="relative group">
                    {/* Glow effect */}
                    <div className={`absolute -inset-1 bg-gradient-to-br ${step.gradient} rounded-3xl opacity-0 group-hover:opacity-30 blur-xl transition-all duration-500`}></div>
                    
                    <div className="relative bg-white dark:bg-gray-800 rounded-3xl p-8 border-2 border-gray-100 dark:border-gray-700 group-hover:border-transparent shadow-lg group-hover:shadow-2xl dark:group-hover:shadow-blue-500/20 transition-all duration-300 h-full">
                      {/* Number badge */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="relative">
                          <div className={`absolute inset-0 bg-gradient-to-br ${step.gradient} blur-xl opacity-40 rounded-2xl`}></div>
                          <div className={`relative w-16 h-16 bg-gradient-to-br ${step.gradient} rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-300`}>
                            <span className="text-2xl font-black text-white">{step.num}</span>
                          </div>
                        </div>
                        
                        {/* Icon in circle */}
                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${step.gradient} bg-opacity-10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                          <step.icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                      
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:bg-clip-text group-hover:from-blue-600 group-hover:to-cyan-600 dark:group-hover:from-blue-400 dark:group-hover:to-cyan-400 transition-all duration-300">
                        {step.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                        {step.desc}
                      </p>
                      
                      {/* Progress indicator */}
                      <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex items-center space-x-2">
                          <div className={`h-1 flex-1 rounded-full bg-gradient-to-r ${step.gradient} opacity-30`}></div>
                          <div className={`h-1 flex-1 rounded-full ${index >= 1 ? `bg-gradient-to-r ${step.gradient} opacity-30` : 'bg-gray-200 dark:bg-gray-700'}`}></div>
                          <div className={`h-1 flex-1 rounded-full ${index >= 2 ? `bg-gradient-to-r ${step.gradient} opacity-30` : 'bg-gray-200 dark:bg-gray-700'}`}></div>
                        </div>
                      </div>
                      
                      {/* Decorative corner element */}
                      <div className="absolute -bottom-2 -right-2 w-20 h-20 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 dark:from-blue-500/10 dark:to-cyan-500/10 rounded-tl-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Call to action */}
            <div className="text-center mt-16">
              <Link 
                href="#get-started"
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-xl shadow-blue-600/30 hover:shadow-2xl hover:shadow-blue-600/50 hover:scale-105 transition-all duration-300"
              >
                <span>Get Started Now</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-100 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                © 2025 Furman University - Smart Attendance System
              </p>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">System Online</span>
              </div>
            </div>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(60px, 60px); }
        }
        
        @keyframes float-orb-slow {
          0%, 100% {
            transform: translate(0, 0);
            opacity: 0.08;
          }
          50% {
            transform: translate(20px, -20px);
            opacity: 0.12;
          }
        }
        
        @keyframes qr-gentle {
          0%, 100% {
            opacity: 0;
          }
          50% {
            opacity: 0.5;
          }
        }
        
        @keyframes scan-slow {
          0% {
            top: -5px;
            opacity: 0;
          }
          50% {
            opacity: 0.5;
          }
          100% {
            top: 100%;
            opacity: 0;
          }
        }
        
        @keyframes fall-slow {
          0% {
            top: -60px;
            opacity: 0;
            transform: rotate(0deg);
          }
          5% {
            opacity: 0.3;
          }
          95% {
            opacity: 0.3;
          }
          100% {
            top: 100%;
            opacity: 0;
            transform: rotate(180deg);
          }
        }
        
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        /* Animation Classes */
        .animate-float-orb-slow {
          animation: float-orb-slow 20s ease-in-out infinite;
        }
        
        .animate-qr-gentle {
          animation: qr-gentle 15s ease-in-out infinite;
        }
        
        .animate-scan-slow {
          animation: scan-slow 20s ease-in-out infinite;
        }
        
        .animate-fall-slow {
          animation: fall-slow 15s linear infinite;
        }
        
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </div>
  );
}
