import React from 'react';
import './ConsoleBox.scss';

interface ConsoleBoxProps {
    message: string;
}

const ConsoleBox: React.FC<ConsoleBoxProps> = ({ message }) => {
    return (
        <div className="console-box">
            {message}
        </div>
    );
}

export default ConsoleBox;
