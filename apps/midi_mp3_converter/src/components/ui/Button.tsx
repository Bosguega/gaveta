import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
}

export function Button({ children, className, type = 'button', ...rest }: ButtonProps) {
    const classes = className ? 'btn bevel-out ' + className : 'btn bevel-out';
    return (
        <button type={type} className={classes} {...rest}>
            {children}
        </button>
    );
}