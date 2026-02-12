'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

const Hero = () => {
  return (
    <div className="relative bg-gradient-to-b from-[#F9FAFB] to-[#E9F3EF] overflow-hidden">
      {/* Background blob */}
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-gradient-to-r from-[#8ACB8C] to-[#0B3D60] opacity-10 rounded-full filter blur-3xl -z-10"></div>
      <div className="absolute -bottom-20 -left-40 w-[500px] h-[500px] bg-gradient-to-r from-[#D9A441] to-[#8ACB8C] opacity-5 rounded-full filter blur-3xl -z-10"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left column - Text content */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-4"
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-snug [text-shadow:1px_1px_2px_rgba(0,0,0,0.1)]">
                <span className="text-[#235E4B] block">Kinder stärken.</span>
                <span className="text-[#D9A441] block">Eltern ermutigen.</span>
                <span className="text-[#0B3D60] block">Bildung verändern.</span>
              </h1>
              
              <p className="text-lg text-gray-800 max-w-lg">
                Wir schützen Kinder vor <span className="text-[#0B3D60] font-medium">Druck</span> und <span className="text-[#0B3D60] font-medium">Überforderung</span> – und geben Eltern eine <span className="text-[#D9A441] font-medium">starke Stimme</span>.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4 pt-4"
            >
              <Link 
                href="/vision" 
                className="px-8 py-3 bg-[#235E4B] text-white font-medium rounded-lg shadow-md hover:bg-[#1a4739] transition-all duration-300 ease-in-out text-center transform hover:scale-105"
              >
                Mehr über die Vision
              </Link>
              <Link 
                href="/bewegung" 
                className="px-8 py-3 border-2 border-[#235E4B] text-[#235E4B] font-medium rounded-lg hover:bg-[#235E4B]/10 transition-all duration-300 ease-in-out text-center transform hover:scale-105"
              >
                Bewegung entdecken
              </Link>
            </motion.div>
          </div>

          {/* Right column - Image */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative mt-12 lg:mt-0"
          >
            {/* Background blob for image */}
            <div className="absolute -z-10 w-full h-full -bottom-6 -right-6 bg-gradient-to-br from-[#8ACB8C] to-[#0B3D60] opacity-20 rounded-2xl"></div>
            
            <div className="relative bg-white p-3 rounded-2xl shadow-xl shadow-black/10 overflow-hidden border border-gray-100">
              <div className="relative aspect-[3/4] w-full max-w-sm mx-auto">
                <Image
                  src="/founder.png"
                  alt="Ioannis Papachristos, Gründer von Eltern–Kind–Wandel"
                  fill
                  className="object-cover rounded-lg"
                  priority
                />
                {/* Gold accent line */}
                <div className="absolute top-4 left-4 w-20 h-1.5 bg-[#D9A441] rounded-full"></div>
              </div>
              
              <div className="absolute -bottom-1 -right-1 w-16 h-16 border-r-4 border-b-4 border-[#D9A441] rounded-br-xl"></div>
            </div>
            
            <p className="mt-4 text-sm text-gray-600 text-center">
              Ioannis Papachristos, Gründer von Eltern–Kind–Wandel
            </p>
          </motion.div>
        </div>
      </div>

      {/* Wave divider */}
      <div className="relative h-20 w-full overflow-hidden">
        <div className="absolute bottom-0 left-0 w-full h-full bg-gradient-to-t from-[#235E4B]/15 to-transparent"></div>
        <svg 
          className="absolute bottom-0 left-0 w-full h-12 text-[#235E4B]" 
          viewBox="0 0 1200 120" 
          preserveAspectRatio="none"
        >
          <path 
            d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512,54.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z" 
            opacity=".25"
            fill="currentColor"
            className="text-[#235E4B]"
          ></path>
          <path 
            d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,141.56,72.34,25.6,44.53,16.45,100.24-22.17,137.55-29.8,29.12-70.53,44.9-113.55,46.52-42.16,1.6-83.71-14.81-123.2-30.85-50.86-20.81-97.66-54.25-150.64-54.25-48.92,0-95.06,23.18-120.2,60.51-15.8,23.34-23.66,51.1-25.06,79.37-1.12,22.3,2.2,44.62,9.75,65.23-26.67-2.15-53.16-7.47-78.89-16.13Z" 
            opacity=".5"
            fill="currentColor"
            className="text-[#235E4B]"
          ></path>
          <path 
            d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z" 
            fill="currentColor"
            className="text-[#235E4B]"
          ></path>
        </svg>
      </div>
    </div>
  );
};

export default Hero;
