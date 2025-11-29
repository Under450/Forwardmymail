import React from 'react';
import { Mail, ScanLine, Building2, Briefcase, UserCheck, FileText, Package } from 'lucide-react';

interface ServiceCardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  features: string[];
}

const ServiceCard: React.FC<ServiceCardProps> = ({ title, description, icon: Icon, features }) => (
  <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 group hover:-translate-y-1">
    <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center mb-6 group-hover:bg-brand-700 transition-colors duration-300">
      <Icon className="w-7 h-7 text-slate-600 group-hover:text-white transition-colors duration-300" />
    </div>
    <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
    <p className="text-slate-600 mb-6 leading-relaxed text-sm">{description}</p>
    <ul className="space-y-2">
      {features.map((feature, idx) => (
        <li key={idx} className="flex items-center text-sm text-slate-500">
          <span className="w-1.5 h-1.5 bg-brand-600 rounded-full mr-2"></span>
          {feature}
        </li>
      ))}
    </ul>
  </div>
);

export const Services: React.FC = () => {
  const services = [
    {
      title: "Mail Forwarding",
      description: "Get a UK address and have your post physically forwarded to you anywhere in the world.",
      icon: Mail,
      features: ["Daily or weekly forwarding", "Filter junk mail", "Competitive postage rates"]
    },
    {
      title: "Digital Mailroom",
      description: "We open, scan, and securely upload your mail to your private portal. View it from anywhere.",
      icon: ScanLine,
      features: ["High-quality PDF scans", "OCR text search", "Secure cloud storage"]
    },
    {
      title: "Virtual Business Address",
      description: "A professional trading address for your website, invoices, and marketing materials.",
      icon: Building2,
      features: ["Established business centre", "Enhance brand image", "Keep home address private"]
    },
    {
      title: "Registered Office",
      description: "The official address for Companies House. Meets all legal requirements for UK Ltd companies.",
      icon: Briefcase,
      features: ["Official government mail only", "Companies House compliant", "Protect residential privacy"]
    },
    {
      title: "Director Service Address",
      description: "Keep your residential address off the public register by using our address for director correspondence.",
      icon: UserCheck,
      features: ["Public record privacy", "Statutory mail handling", "Includes all directors"]
    },
    {
      title: "Company Formation",
      description: "Ready to start? We can incorporate your UK Limited company and set up your address in one go.",
      icon: FileText,
      features: ["£18.50 + £50 Companies House fee", "Digital documents", "Fast track formation"]
    }
  ];

  return (
    <section id="services" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-base font-semibold text-brand-700 tracking-wide uppercase">Our Services</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Everything You Need to Run a UK Business Remotely
          </p>
          <p className="mt-4 text-xl text-slate-500">
            From basic mail handling to full corporate compliance, we provide the infrastructure for your success.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, idx) => (
            <ServiceCard key={idx} {...service} />
          ))}
        </div>

        <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-4 bg-white p-4 rounded-full shadow-sm border border-slate-100">
                <span className="text-slate-600 text-sm font-medium px-2">Also available:</span>
                <span className="flex items-center text-sm text-slate-800 font-semibold"><Package className="w-4 h-4 mr-1 text-brand-600"/> Parcel Handling</span>
            </div>
        </div>
      </div>
    </section>
  );
};