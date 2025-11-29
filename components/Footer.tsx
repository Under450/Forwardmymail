import React from 'react';
import { Mail } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-300 py-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          
          <div className="col-span-1 md:col-span-1">
             <div className="flex items-center gap-2 mb-4 text-white">
                <div className="w-8 h-8 bg-brand-700 rounded-lg flex items-center justify-center">
                  <Mail size={16} />
                </div>
                <span className="font-bold text-lg">Forwardmymail</span>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Premium mail handling and virtual office services for businesses worldwide.
            </p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Services</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Mail Forwarding</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Digital Mailroom</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Registered Office</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Company Formation</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Client Login</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms & Conditions</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Cookie Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Acceptable Use</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8 text-xs text-slate-500 flex flex-col md:flex-row justify-between items-center">
          <p>&copy; {new Date().getFullYear()} Forwardmymail Ltd. All rights reserved. Registered in England & Wales.</p>
          <p className="mt-2 md:mt-0 max-w-md text-center md:text-right">
            We are supervised by HMRC for Anti-Money Laundering (AML) compliance. We do not support illegal activities.
          </p>
        </div>
      </div>
    </footer>
  );
};