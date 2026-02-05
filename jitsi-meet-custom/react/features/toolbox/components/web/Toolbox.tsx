import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';

import EmailInviteButton from './EmailInviteButton';
import BrowserRecordButton from './BrowserRecordButton';

import { IReduxState } from '../../../app/types';
import { getLocalParticipant } from '../../../base/participants/functions';
import ContextMenu from '../../../base/ui/components/web/ContextMenu';
import { isCCTabEnabled } from '../../../subtitles/functions.any';
import { isTranscribing } from '../../../transcribing/functions';
import {
    setHangupMenuVisible,
    setOverflowMenuVisible,
    setToolboxVisible
} from '../../actions.web';
import {
    getJwtDisabledButtons,
    getVisibleButtons,
    getVisibleButtonsForReducedUI,
    isButtonEnabled,
    isToolboxVisible
} from '../../functions.web';
import { useKeyboardShortcuts, useToolboxButtons } from '../../hooks.web';
import { IToolboxButton } from '../../types';

import HangupButton from '../HangupButton';
import { EndConferenceButton } from './EndConferenceButton';
import HangupMenuButton from './HangupMenuButton';
import { LeaveConferenceButton } from './LeaveConferenceButton';
import OverflowMenuButton from './OverflowMenuButton';
import Separator from './Separator';
import { downloadAlertLogs, clearAlertLogs } from '../../../base/logging/alertLogger';

const useStyles = makeStyles()(() => ({
    hangupMenu: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        rowGap: '8px',
        padding: '16px'
    }
}));

export default function Toolbox({ toolbarButtons }: { toolbarButtons?: Array<string> }) {
    const { classes, cx } = useStyles();
    const dispatch = useDispatch();
    const toolboxRef = useRef<HTMLDivElement>(null);

    // 1. MODERATOR ROLE CHECK (The 'M' Symbol)
    // We only check if the participant has the moderator role assigned by Jitsi.
    const { isModerator } = useSelector((state: any) => {
        const localPart = getLocalParticipant(state);
        
        return {
            isModerator: localPart?.role === 'moderator' // This looks for the Blue 'M' star
        };
    });

    const conference = useSelector((s: IReduxState) => s['features/base/conference'].conference);
    const videoSpaceWidth = useSelector((s: IReduxState) => s['features/base/responsive-ui'].videoSpaceWidth);
    
    const toolbarVisible = useSelector(isToolboxVisible);
    const reduxToolbarButtons = useSelector((s: IReduxState) => s['features/toolbox'].toolbarButtons);
    const buttonsWithNotifyClick = useSelector((s: IReduxState) => s['features/toolbox'].buttonsWithNotifyClick);
    const overflowMenuVisible = useSelector((s: IReduxState) => s['features/toolbox'].overflowMenuVisible);
    const hangupMenuVisible = useSelector((s: IReduxState) => s['features/toolbox'].hangupMenuVisible);
    const shiftUp = useSelector((s: IReduxState) => s['features/toolbox'].shiftUp);
    const reducedUI = useSelector((s: IReduxState) => s['features/base/responsive-ui'].reducedUI);
    const mainToolbarButtonsThresholds = useSelector(
        (s: IReduxState) => s['features/toolbox'].mainToolbarButtonsThresholds
    );

    const transcribing = useSelector(isTranscribing);
    const ccEnabled = useSelector(isCCTabEnabled);
    const localParticipant = useSelector(getLocalParticipant);
    const jwtDisabledButtons = getJwtDisabledButtons(transcribing, ccEnabled, localParticipant?.features);
    const customToolbarButtons = useSelector((s: IReduxState) => s['features/base/config'].customToolbarButtons);
    const allButtons = useToolboxButtons(customToolbarButtons);

    const toolbarButtonsToUse = toolbarButtons || reduxToolbarButtons;
    useKeyboardShortcuts(toolbarButtonsToUse);

    const normalUI = getVisibleButtons({
        allButtons,
        buttonsWithNotifyClick,
        toolbarButtons: toolbarButtonsToUse,
        clientWidth: videoSpaceWidth,
        jwtDisabledButtons,
        mainToolbarButtonsThresholds
    });

    const reducedUIButtons = getVisibleButtonsForReducedUI({
        allButtons,
        buttonsWithNotifyClick,
        jwtDisabledButtons,
        reducedUImainToolbarButtons: []
    });

    // 2. THE FILTER: Lock extra icons based ONLY on the Moderator 'M' star
    const mainMenuButtons = (reducedUI ? reducedUIButtons.mainMenuButtons : normalUI.mainMenuButtons)
        .filter(btn => {
            // If you have the 'M' star, you see everything.
            if (isModerator) {
                return true;
            }
            
            // If you ARE NOT a moderator, you ONLY see these 3 symbols.
            return ['microphone', 'camera', 'hangup'].includes(btn.key);
        });

    const endConferenceSupported = Boolean(conference?.isEndConferenceSupported() && isModerator);

    return (
        <div className={cx('new-toolbox', toolbarVisible && 'visible', shiftUp && 'shift-up')}>
            <div className="toolbox-content">
                <div className="toolbox-content-items" ref={toolboxRef}>
                    
                    {/* Render Filtered Main Buttons */}
                    {mainMenuButtons.map(({ Content, key, ...rest }) =>
                        Content !== Separator ? (
                            <Content {...rest} buttonKey={key} key={key} />
                        ) : null
                    )}
                    
                    {/* 3. MODERATOR-ONLY AREA (Invite, Record, Logs) */}
                    {/* This is now strictly tied to the isModerator role */}
                    {isModerator && (
                        <>
                            <EmailInviteButton />
                            <BrowserRecordButton />
                            <button 
                                onClick={() => downloadAlertLogs()} 
                                style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '0 10px', fontWeight: 'bold' }}
                            >
                                ⭳ Download Logs
                            </button>
                            <button 
                                onClick={() => clearAlertLogs()} 
                                style={{ background: 'transparent', border: 'none', color: 'orange', cursor: 'pointer', padding: '0 10px', fontWeight: 'bold' }}
                            >
                                ✖ Clear Logs
                            </button>

                            {normalUI.overflowMenuButtons.length > 0 && (
                                <OverflowMenuButton
                                    buttons={[ normalUI.overflowMenuButtons ]} 
                                    isOpen={overflowMenuVisible}
                                    onVisibilityChange={(v: boolean) => dispatch(setOverflowMenuVisible(v))} 
                                />
                            )}
                        </>
                    )}

                    {isButtonEnabled('hangup', toolbarButtonsToUse) && (
                        endConferenceSupported ? (
                            <HangupMenuButton
                                isOpen={hangupMenuVisible}
                                onVisibilityChange={(v: boolean) => dispatch(setHangupMenuVisible(v))}>
                                <ContextMenu className={classes.hangupMenu} hidden={!hangupMenuVisible}>
                                    <EndConferenceButton buttonKey="end-meeting" />
                                    <LeaveConferenceButton buttonKey="hangup" />
                                </ContextMenu>
                            </HangupMenuButton>
                        ) : (
                            <HangupButton buttonKey="hangup" />
                        )
                    )}
                </div>
            </div>
        </div>
    );
}