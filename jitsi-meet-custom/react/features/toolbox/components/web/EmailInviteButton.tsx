
import React from 'react';
import { IconEnvelope } from '../../../base/icons/svg';
import Icon from '../../../base/icons/components/Icon';
import { useSelector } from 'react-redux';
import { IReduxState } from '../../../app/types';


export default function EmailInviteButton() {

    // 🔐 Check if current user is moderator (admin)
    const isModerator = useSelector(
        (state: IReduxState) => state['features/base/participants']?.local?.role === 'moderator'
    );

    // 🚫 If not admin, don't show button at all
    if (!isModerator) {
        return null;
    }
    


    const handleClick = async () => {
        const emailsInput = prompt(
            'Enter email addresses (comma separated)'
        );
        if (!emailsInput) return;

        const emails = emailsInput
             .split(',')
             .map(e => e.trim())
             .filter(Boolean);


        // ✅ Always correct meeting URL
        const meetingUrl = window.location.href;

        try {
            const response = await fetch('http://localhost:5000/send-invite', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                           emails,
                           meetingUrl   // 🔑 KEY NAME
                })
            });

            if (response.ok) {
                alert('Email invitation sent successfully');
            } else {
                alert('Failed to send email');
            }
        } catch (error) {
            console.error(error);
            alert('Server error');
        }
    };

    return (
        <button
            onClick={handleClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer'
            }}
        >
            <Icon src={IconEnvelope} />
            <span>Email Invite</span>
        </button>
    );
} 
