import { ComponentProps } from '@/types';

interface CardProps extends ComponentProps {
  variant?: 'default' | 'outlined' | 'elevated';
}

export function Card({ 
  children, 
  variant = 'default', 
  className = '',
  onClick
}: CardProps) {
  const baseClasses = 'card';
  const variantClasses = {
    default: 'bg-white',
    outlined: 'border-2',
    elevated: 'shadow-lg'
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${className}`;

  return (
    <div className={classes} onClick={onClick}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: ComponentProps) {
  return (
    <div className={`px-6 py-4 border-b border-gray-200 ${className}`}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = '' }: ComponentProps) {
  return (
    <div className={`px-6 py-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }: ComponentProps) {
  return (
    <h3 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '' }: ComponentProps) {
  return (
    <p className={`text-sm text-muted-foreground ${className}`}>
      {children}
    </p>
  );
}

export function CardFooter({ children, className = '' }: ComponentProps) {
  return (
    <div className={`px-6 py-4 border-t border-gray-200 ${className}`}>
      {children}
    </div>
  );
}
