import React from 'react';
import { Button } from './Button';
import { ShieldCheck, MapPin, MailOpen, Smartphone } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <div className="relative overflow-hidden bg-slate-50 pt-32 pb-16 lg:pt-48 lg:pb-32">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 opacity-5">
         <svg width="600" height="600" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <path fill="#0f2e5a" d="M44.7,-76.4C58.9,-69.2,71.8,-59.1,81.6,-46.6C91.4,-34.1,98.1,-19.2,95.8,-4.9C93.5,9.4,82.2,23.1,71.2,35.3C60.2,47.5,49.5,58.2,37.3,65.9C25.1,73.6,11.4,78.3,-1.9,81.6C-15.2,84.9,-29.1,86.8,-41.6,80.7C-54.1,74.6,-65.2,60.5,-73.4,45.4C-81.6,30.3,-86.9,14.2,-86.3,-1.6C-85.7,-17.4,-79.2,-32.9,-68.8,-46C-58.4,-59.1,-44.1,-69.8,-29.3,-76.5C-14.5,-83.2,0.8,-85.9,15.6,-83.3C30.4,-80.7,44.7,-72.8,44.7,-76.4Z" transform="translate(100 100)" />
         </svg>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="lg:grid lg:grid-cols-12 lg:gap-16 items-center">
          
          <div className="lg:col-span-6 text-center lg:text-left mb-12 lg:mb-0">
            <div className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700 mb-6 border border-brand-200 shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-brand-700 mr-2"></span>
              The UK's Trusted Virtual Address Service
            </div>
            <h1 className="text-4xl lg:text-6xl font-bold tracking-tight text-slate-900 mb-6 leading-tight">
              A Prestigious UK <br/>
              <span className="text-brand-700">Business Address</span> <br/>
              Wherever You Are.
            </h1>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed max-w-2xl mx-auto lg:mx-0">
              Secure mail forwarding, digital scanning, and official registered office services. Establish a professional presence at our established business centre, perfect for directors and remote businesses.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button size="lg" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
                Get Your Address
              </Button>
              <Button variant="outline" size="lg" onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}>
                View Services
              </Button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative rounded-2xl shadow-2xl overflow-hidden border border-slate-200 bg-white">
                {/* Professional architectural image - low angle glass building */}
                <img 
                  src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=1000" 
                  alt="Modern UK Corporate Office Architecture" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-900/80 to-transparent flex items-end p-8">
                  <div className="text-white">
                     <p className="font-semibold text-lg">Secure & Confidential</p>
                     <p className="text-slate-200 text-sm">Your mail, handled professionally in our secure facility.</p>
                  </div>
                </div>
            </div>
          </div>
          
        </div>
      </div>

      {/* How it works strip */}
      <div className="mt-20 border-t border-slate-200 bg-white" id="how-it-works">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: MapPin, title: "1. Sign Up", desc: "Instantly secure your new business address." },
              { icon: ShieldCheck, title: "2. Verify ID", desc: "Quick online identity verification (KYC)." },
              { icon: MailOpen, title: "3. We Receive Mail", desc: "We accept mail and parcels on your behalf." },
              { icon: Smartphone, title: "4. You Manage Online", desc: "Read scans or request forwarding instantly." },
            ].map((step, idx) => (
              <div key={idx} className="flex flex-col items-center text-center p-4 group">
                <div className="w-12 h-12 bg-brand-50 text-brand-700 rounded-full flex items-center justify-center mb-4 group-hover:bg-brand-700 group-hover:text-white transition-colors duration-300">
                  <step.icon size={24} />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};