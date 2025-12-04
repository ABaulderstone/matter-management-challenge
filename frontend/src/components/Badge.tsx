import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  customClasses?: string;
}

export default function Badge({
  className = '',
  customClasses,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={`${className} px-2 py-1 text-xs font-semibold rounded-full ${
        customClasses ?? ''
      }`}
      {...rest}
    >
      {children}
    </span>
  );
}
