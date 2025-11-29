import React from 'react';
import { Button } from './Button';
import { Mail, Phone, MapPin } from 'lucide-react';

export const Contact: React.FC = () => {
  return (
    <section id="contact" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Get in Touch</h2>
            <p className="text-lg text-slate-600 mb-8">
              Whether you need help choosing a plan or have a specific question about compliance, our team is here to help.
            </p>

            <div className="space-y-6">
              <div className="flex items-start">
                <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0 text-brand-700">
                  <Mail size={20} />
                </div>
                <div className="ml-4">
                  <h4 className="text-sm font-semibold text-slate-900">Email</h4>
                  <p className="text-slate-600">info@forwardmymail.co.uk</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0 text-brand-700">
                  <Phone size={20} />
                </div>
                <div className="ml-4">
                  <h4 className="text-sm font-semibold text-slate-900">Phone</h4>
                  <p className="text-slate-600">01543 406028</p>
                  <p className="text-xs text-slate-500 mt-1">Mon-Fri, 9am - 5:30pm GMT</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0 text-brand-700">
                  <MapPin size={20} />
                </div>
                <div className="ml-4">
                  <h4 className="text-sm font-semibold text-slate-900">Office</h4>
                  <p className="text-slate-600">
                    8a Bore Street<br/>
                    Lichfield, Staffordshire<br/>
                    WS13 6LL
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200">
            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                  <input type="text" id="name" className="w-full rounded-lg border-slate-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 h-11 px-4 border" placeholder="John Doe" />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" id="email" className="w-full rounded-lg border-slate-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 h-11 px-4 border" placeholder="john@company.com" />
                </div>
              </div>
              
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-slate-700 mb-1">Company (Optional)</label>
                <input type="text" id="company" className="w-full rounded-lg border-slate-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 h-11 px-4 border" placeholder="Your Business Ltd" />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                <textarea id="message" rows={4} className="w-full rounded-lg border-slate-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 p-4 border" placeholder="How can we help?"></textarea>
              </div>

              <Button size="lg" className="w-full">Send Message</Button>
            </form>
          </div>

        </div>
      </div>
    </section>
  );
};