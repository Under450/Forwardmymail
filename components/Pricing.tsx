import React from 'react';
import { Button } from './Button';
import { Check, PackageOpen } from 'lucide-react';

const PricingCard: React.FC<{
  title: string;
  price: string;
  description: string;
  features: string[];
  popular?: boolean;
}> = ({ title, price, description, features, popular }) => (
  <div className={`relative flex flex-col p-8 bg-white rounded-2xl border ${popular ? 'border-brand-700 ring-2 ring-brand-700 ring-opacity-10 shadow-xl scale-105 z-10' : 'border-slate-200 shadow-sm'}`}>
    {popular && (
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <span className="bg-brand-700 text-white text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-full shadow-md">
          Most Popular
        </span>
      </div>
    )}
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-slate-500 text-sm">{description}</p>
    </div>
    <div className="mb-6">
      <span className="text-4xl font-bold text-slate-900">{price}</span>
      <span className="text-slate-500 text-base">/year</span>
    </div>
    <ul className="space-y-4 mb-8 flex-1">
      {features.map((feature, idx) => (
        <li key={idx} className="flex items-start">
          <Check className="flex-shrink-0 w-5 h-5 text-brand-600 mt-0.5" />
          <span className="ml-3 text-slate-600 text-sm">{feature}</span>
        </li>
      ))}
    </ul>
    <Button variant={popular ? 'primary' : 'outline'} className="w-full">
      Choose Plan
    </Button>
  </div>
);

export const Pricing: React.FC = () => {
  return (
    <section id="pricing" className="py-24 bg-white border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-base font-semibold text-brand-700 tracking-wide uppercase">Pricing</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Simple, Transparent Pricing
          </p>
          <p className="mt-4 text-xl text-slate-500">
            All plans include access to our secure online portal. Prices exclude VAT.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-start mb-16">
          <PricingCard
            title="Personal Mailbox"
            price="£99"
            description="For individuals needing a secure UK mailing address."
            features={[
              "Premium Business Address",
              "Mail Receipt & Sorting",
              "Scan or Forward options",
              "Secure Online Account",
              "No Business Use"
            ]}
          />
          <PricingCard
            title="Business Address"
            price="£149"
            description="Perfect for sole traders and freelancers."
            features={[
              "Premium Business Address",
              "Use on Website & Invoices",
              "Mail Scanning & Forwarding",
              "Unlimited Mail Receipt",
              "Junk Mail Filtering",
              "Free Setup"
            ]}
          />
          <PricingCard
            title="Registered Office"
            price="£189"
            description="Complete compliance package for Ltd companies."
            popular={true}
            features={[
              "Everything in Business",
              "Registered Office Address",
              "Director Service Address",
              "Official Gov Mail Handling",
              "Compliance Checks Included"
            ]}
          />
           <PricingCard
            title="Full Virtual Office"
            price="£299"
            description="The ultimate professional image for your company."
            features={[
              "Everything in Registered Office",
              "UK Local Phone Number",
              "Call Answering Service",
              "Parcel Handling"
            ]}
          />
        </div>

        <div className="max-w-5xl mx-auto bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden mb-12 shadow-sm">
          <div className="bg-white border-b border-slate-200 px-6 py-5 md:px-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <PackageOpen className="text-brand-700" size={24} />
                Ultimate + Parcel Handling Package
              </h3>
              <p className="text-slate-500 text-sm mt-1">
                Usage rates for items beyond inclusive allowances. Applicable to Business, Registered Office & Virtual Office plans.
              </p>
            </div>
          </div>
          <div className="p-6 md:p-8 grid md:grid-cols-2 gap-8 md:gap-12">
            <div>
              <h4 className="font-semibold text-brand-800 mb-4 border-b border-slate-200 pb-2">Mail & Scanning</h4>
              <ul className="space-y-4 text-sm">
                <li className="flex justify-between items-start">
                  <span className="text-slate-700 font-medium">Letters</span>
                  <span className="text-slate-600 text-right">£0.25–£0.75 per item <br/>+ actual postage</span>
                </li>
                <li className="flex justify-between items-start">
                  <span className="text-slate-700 font-medium">Extra Scanning</span>
                  <span className="text-slate-600 text-right">£0.40–£0.60 per page <br/><span className="text-xs text-slate-400">(beyond inclusive allowance)</span></span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-brand-800 mb-4 border-b border-slate-200 pb-2">Parcels & Storage</h4>
              <ul className="space-y-4 text-sm">
                <li className="flex justify-between items-start">
                  <span className="text-slate-700 font-medium">Standard Parcels <span className="text-slate-400 font-normal">(up to ~5kg)</span></span>
                  <span className="text-slate-600 text-right">£1.50–£3.00 per parcel <br/>+ postage</span>
                </li>
                <li className="flex justify-between items-start">
                  <span className="text-slate-700 font-medium">Oversize / Heavy / Courier</span>
                  <span className="text-slate-600 text-right">Special handling fee: <br/>£8–£15 per item</span>
                </li>
                <li className="flex justify-between items-start">
                  <span className="text-slate-700 font-medium">Long-term Storage</span>
                  <span className="text-slate-600 text-right">Free (5 days), then £1–£3/day.<br/><span className="text-xs text-slate-400">Bulky items on request.</span></span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 bg-slate-50 rounded-lg p-6 text-center text-sm text-slate-500 max-w-2xl mx-auto border border-slate-200">
          <p className="font-semibold text-slate-900 mb-1">UK Compliance Notice</p>
          <p>
            In accordance with UK Anti-Money Laundering (AML) regulations, we are required to verify the identity (ID) and address of all customers. This is a simple digital process completed after sign-up.
          </p>
        </div>
      </div>
    </section>
  );
};