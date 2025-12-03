import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  customClasses?: string;
}

export default function Badge({ customClasses, children }: BadgeProps) {
  return (
    <span
      className={`px-2 py-1 text-xs font-semibold rounded-full ${
        customClasses ?? ''
      }`}
    >
      {children}
    </span>
  );
}
