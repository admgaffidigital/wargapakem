import React from 'react';

export function Icon({ name, className = "text-[17px]", fill = "false" }) {
    return (
        <span
            className={`material-symbols-rounded shrink-0 select-none flex items-center justify-center ${className}`}
            style={{
                fontVariationSettings: fill === 'true' || fill === true ? "'FILL' 1" : "'FILL' 0",
                lineHeight: '1em',
                width: '1em',
                height: '1em'
            }}
            aria-hidden="true"
        >
            {name}
        </span>
    );
}

export default Icon;
