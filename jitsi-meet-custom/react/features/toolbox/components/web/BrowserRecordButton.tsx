import React, { useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import Icon from '../../../base/icons/components/Icon';
import { IconVideo } from '../../../base/icons/svg';
import { IReduxState } from '../../../app/types';

const BrowserRecordButton = () => {
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const [ recording, setRecording ] = useState(false);

    const isModerator = useSelector(
        (state: IReduxState) =>
            state['features/base/participants'].local?.role === 'moderator'
    );

    if (!isModerator) {
        return null;
    }

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });

            const recorder = new MediaRecorder(stream);

            recorder.ondataavailable = (event: BlobEvent) => {
                if (event.data && event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            recorder.onstop = () => {
                /** 
                 * We NEVER use BlobOptions — only File.
                 * This avoids the TS2345 error.
                 */
                const file = new File(
                    chunksRef.current,
                    `recording-${Date.now()}.webm`,
                    {
                        type: 'video/webm',
                        lastModified: Date.now()
                    }
                );

                chunksRef.current = [];

                const url = URL.createObjectURL(file);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.name;
                a.style.display = 'none';

                document.body.appendChild(a);
                a.click();

                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);

                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start();
            recorderRef.current = recorder;
            setRecording(true);

        } catch (error) {
            console.error('Recording failed:', error);
        }
    };

    const stopRecording = () => {
        recorderRef.current?.stop();
        setRecording(false);
    };

    return (
        <button
            type='button'
            onClick={recording ? stopRecording : startRecording}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'transparent',
                border: 'none',
                color: recording ? 'red' : 'white',
                cursor: 'pointer',
                padding: '0 10px'
            }}
        >
            <Icon src={IconVideo} size={24} />
            <span>{recording ? 'Stop Recording' : 'Start Recording'}</span>
        </button>
    );
};

export default BrowserRecordButton;
