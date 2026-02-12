'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/app/actions/auth';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  
  // Animated gradient background effect
  useEffect(() => {
    const animateBackground = () => {
      const colors = [
        'from-blue-500 via-purple-500 to-pink-500',
        'from-purple-500 via-pink-500 to-blue-500',
        'from-pink-500 via-blue-500 to-purple-500',
      ];
      let index = 0;
      
      const bgElement = document.getElementById('animated-bg');
      if (!bgElement) return;
      
      const changeColor = () => {
        bgElement.className = `absolute inset-0 bg-gradient-to-br ${colors[index]} animate-gradient`;
        index = (index + 1) % colors.length;
      };
      
      changeColor();
      const interval = setInterval(changeColor, 5000);
      
      return () => clearInterval(interval);
    };
    
    animateBackground();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const result = await login(username, password);
      if (result.success) {
        router.push(result.redirect || '/');
        router.refresh();
      } else {
        setError(result.error || 'Anmeldung fehlgeschlagen');
      }
    } catch (err) {
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Animated Background */}
      <div id="animated-bg" className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 animate-gradient">
        <div className="absolute inset-0 bg-black/10 backdrop-blur-sm"></div>
      </div>
      
      {/* Animated floating elements */}
      {[...Array(10)].map((_, i) => (
        <div 
          key={i}
          className="absolute rounded-full bg-white/10 backdrop-blur-sm"
          style={{
            width: `${Math.random() * 100 + 50}px`,
            height: `${Math.random() * 100 + 50}px`,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animation: `float ${Math.random() * 10 + 10}s linear infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }}
        />
      ))}
      
      <style jsx global>{`
        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          25% {
            transform: translate(20px, 20px) rotate(5deg);
          }
          50% {
            transform: translate(0, 40px) rotate(0deg);
          }
          75% {
            transform: translate(-20px, 20px) rotate(-5deg);
          }
        }
        
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 15s ease infinite;
        }
        
        @keyframes gradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-md space-y-8 bg-white/80 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <img 
                src="/images/tnt-studio-logo.png" 
                alt="TNT Studio Logo" 
                className="h-16 w-auto"
              />
            </div>
            <h2 className="mt-2 text-3xl font-bold text-gray-900">
              Willkommen zurück
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Bitte melden Sie sich an, um fortzufahren
            </p>
          </div>
          
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                    Benutzername
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150"
                    placeholder="Ihr Benutzername"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Passwort
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150"
                    placeholder="Ihr Passwort"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 text-sm text-red-700 bg-red-50 rounded-lg flex items-center">
                  <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <div>
                <button
                  type="submit"
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150"
                >
                  Anmelden
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      
      <div className="mt-12 relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 opacity-20 rounded-full blur-xl group-hover:opacity-30 transition-all duration-500"></div>
        <div className="relative flex flex-col items-center">
          <div className="h-px w-32 bg-gradient-to-r from-transparent via-gray-400 to-transparent mb-3"></div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono text-gray-500 tracking-widest">POWERED BY</span>
          </div>
          <div className="mt-1 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 text-lg font-bold tracking-tight">
            Esteves & Spingys
          </div>
          <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-24 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent group-hover:via-purple-500 transition-all duration-300"></div>
        </div>
      </div>
    </div>
  );
}
