import React from 'react';

export const About: React.FC = () => {
  return (
    <section id="about" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-2 gap-16 items-center">
          <div className="relative mb-12 lg:mb-0">
             <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-lg bg-slate-100">
               <img src="https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&q=80" alt="Team meeting in modern office" className="w-full h-full object-cover" />
             </div>
             <div className="absolute -bottom-6 -right-6 w-48 h-48 bg-brand-50 rounded-full -z-10"></div>
             <div className="absolute -top-6 -left-6 w-32 h-32 bg-slate-50 rounded-full -z-10"></div>
          </div>
          
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Built for Modern Business</h2>
            <div className="space-y-6 text-lg text-slate-600">
              <p>
                Founded in 2023, <strong>Forwardmymail</strong> was created to bridge the gap between traditional mail handling and the digital nomad lifestyle.
              </p>
              <p>
                We understand that modern businesses operate globally. Whether you are an expat living in Spain, a tech startup, or an e-commerce seller in the US, we provide the stability of a physical UK presence.
              </p>
              <p>
                Our mission is simple: to give you a professional image while handling the administrative burden of physical mail, so you can focus on growing your business.
              </p>
            </div>
            
            <div className="mt-8 grid grid-cols-2 gap-6">
                <div className="border-l-4 border-brand-700 pl-4">
                    <p className="text-3xl font-bold text-slate-900">150+</p>
                    <p className="text-sm text-slate-500">Happy Clients</p>
                </div>
                <div className="border-l-4 border-brand-700 pl-4">
                    <p className="text-3xl font-bold text-slate-900">80,000+</p>
                    <p className="text-sm text-slate-500">Items Scanned</p>
                </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};