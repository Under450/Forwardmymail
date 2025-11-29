import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const FAQItem: React.FC<{ question: string; answer: string }> = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-slate-200">
      <button
        className="w-full py-6 text-left flex justify-between items-center focus:outline-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-lg font-medium text-slate-900">{question}</span>
        {isOpen ? <ChevronUp className="text-brand-600" /> : <ChevronDown className="text-slate-400" />}
      </button>
      {isOpen && (
        <div className="pb-6 text-slate-600 leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
};

export const FAQ: React.FC = () => {
  const faqs = [
    {
      question: "Can I use this address as my Registered Office?",
      answer: "Yes, our 'Registered Office' and 'Full Virtual Office' plans specifically allow you to use our professional address as your official registered office with Companies House. This keeps your home address off the public record."
    },
    {
      question: "Do you open my mail by default?",
      answer: "No. For mail forwarding plans, we forward items unopened. For mail scanning plans, we only open and scan mail upon your specific instruction or based on the standing rules you set up in your account."
    },
    {
      question: "Can non-UK residents use this service?",
      answer: "Absolutely. We support clients from all over the world. Many of our customers are international businesses needing a UK presence or expats living abroad."
    },
    {
      question: "What identification do you require?",
      answer: "To comply with UK Anti-Money Laundering (AML) regulations, we require proof of ID (passport/driving license) and proof of address (utility bill/bank statement) for all account holders. This is uploaded securely via our portal."
    },
    {
      question: "How long does it take to set up?",
      answer: "You can sign up instantly. Once you've uploaded your ID documents, we verify them typically within 1-2 working hours. You can start using the address immediately after verification."
    }
  ];

  return (
    <section id="faq" className="py-24 bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900">Frequently Asked Questions</h2>
          <p className="mt-4 text-slate-500">Have a different question? Contact our support team.</p>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 sm:px-8">
          {faqs.map((faq, idx) => (
            <FAQItem key={idx} {...faq} />
          ))}
        </div>
      </div>
    </section>
  );
};