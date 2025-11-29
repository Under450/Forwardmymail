import React, { useState, useEffect } from 'react';
import { Menu, X, Mail } from 'lucide-react';
import { Button } from './Button';

export const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'How It Works', href: '#how-it-works' },
    { name: 'Services', href: '#services' },
    { name: 'Pricing', href: '#pricing' },
    { name: 'About', href: '#about' },
    { name: 'FAQs', href: '#faq' },
    { name: 'Contact', href: '#contact' },
  ];

  return (
    <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm py-2' : 'bg-transparent py-4'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
            <div className="w-10 h-10 bg-brand-700 rounded-lg flex items-center justify-center text-white shadow-sm">
              <Mail size={20} />
            </div>
            <span className={`font-bold text-xl tracking-tight ${scrolled ? 'text-brand-900' : 'text-slate-900'}`}>
              Forward<span className="text-brand-700">mymail</span>
            </span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center space-x-8">
            {navLinks.map((link) => (
              <a 
                key={link.name} 
                href={link.href} 
                className="text-sm font-medium text-slate-600 hover:text-brand-700 transition-colors"
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden lg:flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => window.location.href = '#'}>
              Client Login
            </Button>
            <Button variant="primary" size="sm" className="bg-brand-700 hover:bg-brand-800" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
              Get Started
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden flex items-center">
            <button 
              onClick={() => setIsOpen(!isOpen)} 
              className="text-slate-600 hover:text-slate-900 p-2"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full bg-white border-b border-slate-100 shadow-lg px-4 pt-2 pb-6 flex flex-col space-y-4">
          {navLinks.map((link) => (
            <a 
              key={link.name} 
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="block text-base font-medium text-slate-600 hover:text-brand-700 py-2 border-b border-slate-50 last:border-0"
            >
              {link.name}
            </a>
          ))}
          <div className="flex flex-col space-y-3 pt-4">
            <Button variant="ghost" className="w-full justify-center">Client Login</Button>
            <Button variant="primary" className="w-full justify-center bg-brand-700">Get Started</Button>
          </div>
        </div>
      )}
    </nav>
  );
};