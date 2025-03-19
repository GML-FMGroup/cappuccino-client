import React from 'react';
import './ConsoleBox.scss';

interface ConsoleBoxProps {
    message: {
        executor: string;
        subtask: string;
    };
}

const ConsoleBox: React.FC<ConsoleBoxProps> = ({ message }) => {
    return (
        <div className="console-box">
            <div className="executor">
                <strong>Executor:</strong> {message.executor}
            </div>
            <div className="subtask">
                <strong>Subtask:</strong> {message.subtask}
            </div>
        </div>
    );
}

export default ConsoleBox;
