import React from 'react';
import { Lock, BadgePoundSterling, User, Star } from 'lucide-react';

export const Features: React.FC = () => {
  return (
    <section className="py-24 bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
          <div className="text-center md:text-left">
            <div className="w-12 h-12 bg-brand-700 rounded-lg flex items-center justify-center mb-6 mx-auto md:mx-0 shadow-lg border border-brand-600">
              <User className="text-white" size={24} />
            </div>
            <h3 className="text-xl font-bold mb-3">UK Based Support</h3>
            <p className="text-slate-400">Our support team is based in the UK, ready to help via phone or email during standard business hours.</p>
          </div>
          <div className="text-center md:text-left">
            <div className="w-12 h-12 bg-brand-700 rounded-lg flex items-center justify-center mb-6 mx-auto md:mx-0 shadow-lg border border-brand-600">
              <BadgePoundSterling className="text-white" size={24} />
            </div>
            <h3 className="text-xl font-bold mb-3">No Hidden Fees</h3>
            <p className="text-slate-400">What you see is what you pay. No handling fees for scanning. Clear postage costs.</p>
          </div>
          <div className="text-center md:text-left">
            <div className="w-12 h-12 bg-brand-700 rounded-lg flex items-center justify-center mb-6 mx-auto md:mx-0 shadow-lg border border-brand-600">
              <Lock className="text-white" size={24} />
            </div>
            <h3 className="text-xl font-bold mb-3">Secure & Compliant</h3>
            <p className="text-slate-400">We are registered with HMRC and the ICO. Your data and mail are handled with bank-grade security.</p>
          </div>
        </div>

        {/* Social Proof */}
        <div className="border-t border-slate-800 pt-16">
          <div className="text-center">
             <div className="flex justify-center items-center gap-1 mb-4">
               {[1,2,3,4,5].map(i => <Star key={i} className="w-6 h-6 text-yellow-500 fill-yellow-500" />)}
             </div>
             <p className="text-2xl font-semibold mb-2">"Excellent service and easy to set up."</p>
             <p className="text-slate-500">Rated 4.9/5 on Trustpilot by over 500 customers.</p>
          </div>
        </div>
      </div>
    </section>
  );
};