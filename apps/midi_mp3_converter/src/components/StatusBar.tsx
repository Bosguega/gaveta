interface StatusBarProps {
    message: string;
    soundFont: string;
    doneCount: number;
    totalCount: number;
}

export function StatusBar({ message, soundFont, doneCount, totalCount }: StatusBarProps) {
    return (
        <div className='statusbar'>
            <div className='panel bevel-in status-grow' title={message}>
                {message}
            </div>
            <div className='panel bevel-in'>SoundFont: {soundFont}</div>
            <div className='panel bevel-in'>
                {doneCount} de {totalCount}
            </div>
        </div>
    );
}