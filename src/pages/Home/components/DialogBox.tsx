import React from 'react';
import './DialogBox.scss';

interface DialogBoxProps {
    message: string;
}

const DialogBox: React.FC<DialogBoxProps> = ({ message }) => {
    return (
        <div className="dialog-box">
            {message}
        </div>
    );
}

export default DialogBox;
