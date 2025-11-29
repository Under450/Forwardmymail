import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  children, 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-lg";
  
  const variants = {
    primary: "bg-brand-700 text-white hover:bg-brand-800 shadow-sm", // Darker, more professional blue
    secondary: "bg-slate-900 text-white hover:bg-slate-800 shadow-sm",
    outline: "border border-slate-300 text-slate-700 bg-white hover:bg-slate-50",
    ghost: "text-slate-600 hover:text-brand-700 hover:bg-brand-50",
  };

  const sizes = {
    sm: "h-9 px-4 text-sm",
    md: "h-11 px-6 text-base",
    lg: "h-14 px-8 text-lg",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};