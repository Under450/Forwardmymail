import React from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Services } from './components/Services';
import { Pricing } from './components/Pricing';
import { Features } from './components/Features';
import { About } from './components/About';
import { FAQ } from './components/FAQ';
import { Contact } from './components/Contact';
import { Footer } from './components/Footer';

function App() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Navbar />
      <main>
        <Hero />
        <Services />
        <Features />
        <Pricing />
        <About />
        <FAQ />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}

export default App;