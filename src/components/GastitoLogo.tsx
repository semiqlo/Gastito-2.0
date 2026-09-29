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
 * Logo oficial y definitivo de Gastito (PNG oficial).
 */
export const GastitoLogo: React.FC<GastitoLogoProps> = ({ size = 36, className = '' }) => {
  return (
    <img
      src="/assets/brand/gastito-logo.png"
      width={size}
      height={size}
      className={className}
      alt="Gastito Logo Oficial"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: 'contain',
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
    />
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
    case 'CircleDollarSign':
    default:
      return <CircleDollarSign {...props} />;
  }
};
