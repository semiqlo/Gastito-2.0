import React from 'react';
import {
  Utensils,
  ShoppingCart,
  GraduationCap,
  BookOpen,
  Sparkles,
  Car,
  Stethoscope,
  HeartPulse,
  Home,
  Key,
  Zap,
  Droplets,
  Wifi,
  Globe,
  Film,
  PawPrint,
  MoreHorizontal,
  Briefcase,
  TrendingUp,
  RotateCcw,
  Wallet,
  CreditCard,
  Landmark,
  CircleDollarSign,
} from 'lucide-react';

interface GastitoLogoProps {
  size?: number;
  className?: string;
}

/**
 * Logo oficial de Gastito:
 * Letra "G" estilizada con dos rayas verticales paralelas (estilo signo de dólar $)
 */
export const GastitoLogo: React.FC<GastitoLogoProps> = ({ size = 34, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Gastito Logo"
    >
      <rect width="48" height="48" rx="12" className="fill-emerald-600 dark:fill-emerald-500" />
      {/* Dos rayas verticales paralelas estilo signo $ */}
      <line
        x1="21"
        y1="7"
        x2="21"
        y2="41"
        stroke="white"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeOpacity="0.92"
      />
      <line
        x1="27"
        y1="7"
        x2="27"
        y2="41"
        stroke="white"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeOpacity="0.92"
      />
      {/* Letra G estilizada geométrica */}
      <path
        d="M34 17.5C32.2 14.2 28.5 12 24 12C17.3726 12 12 17.3726 12 24C12 30.6274 17.3726 36 24 36C30.2 36 35.2 31.4 35.9 25.5H24.5"
        stroke="white"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const ICON_OPTIONS = [
  'Utensils',
  'ShoppingCart',
  'GraduationCap',
  'BookOpen',
  'Sparkles',
  'Car',
  'Stethoscope',
  'HeartPulse',
  'Home',
  'Key',
  'Zap',
  'Droplets',
  'Wifi',
  'Globe',
  'Film',
  'PawPrint',
  'Briefcase',
  'TrendingUp',
  'RotateCcw',
  'Wallet',
  'CreditCard',
  'Landmark',
  'MoreHorizontal',
];

export const AVAILABLE_CATEGORY_ICONS = ICON_OPTIONS;

export const CategoryIcon: React.FC<{
  name?: string;
  iconName?: string;
  size?: number;
  className?: string;
}> = ({ name, iconName, size = 18, className = '' }) => {
  const resolvedName = name || iconName || 'MoreHorizontal';
  const props = { size, className };
  switch (resolvedName) {
    case 'Utensils':
      return <Utensils {...props} />;
    case 'ShoppingCart':
      return <ShoppingCart {...props} />;
    case 'GraduationCap':
      return <GraduationCap {...props} />;
    case 'BookOpen':
      return <BookOpen {...props} />;
    case 'Sparkles':
      return <Sparkles {...props} />;
    case 'Car':
      return <Car {...props} />;
    case 'Stethoscope':
      return <Stethoscope {...props} />;
    case 'HeartPulse':
      return <HeartPulse {...props} />;
    case 'Home':
      return <Home {...props} />;
    case 'Key':
      return <Key {...props} />;
    case 'Zap':
      return <Zap {...props} />;
    case 'Droplets':
      return <Droplets {...props} />;
    case 'Wifi':
      return <Wifi {...props} />;
    case 'Globe':
      return <Globe {...props} />;
    case 'Film':
      return <Film {...props} />;
    case 'PawPrint':
      return <PawPrint {...props} />;
    case 'Briefcase':
      return <Briefcase {...props} />;
    case 'TrendingUp':
      return <TrendingUp {...props} />;
    case 'RotateCcw':
      return <RotateCcw {...props} />;
    case 'Wallet':
      return <Wallet {...props} />;
    case 'CreditCard':
      return <CreditCard {...props} />;
    case 'Landmark':
      return <Landmark {...props} />;
    case 'MoreHorizontal':
      return <MoreHorizontal {...props} />;
    default:
      return <CircleDollarSign {...props} />;
  }
};
