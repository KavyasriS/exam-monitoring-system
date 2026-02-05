
// @ts-nocheck

import { throttle } from 'lodash-es';
import React, { useCallback, useState } from 'react';
import { WithTranslation } from 'react-i18next';
import { connect as reactReduxConnect, useDispatch, useSelector, useStore } from 'react-redux';

import StudentMonitor from '../../../monitoring/StudentMonitor';

// @ts-ignore
import VideoLayout from '../../../../../modules/UI/videolayout/VideoLayout';
import { IReduxState, IStore } from '../../../app/types';
import { getConferenceNameForTitle } from '../../../base/conference/functions';
import { hangup } from '../../../base/connection/actions.web';
import { isMobileBrowser } from '../../../base/environment/utils';
import { translate } from '../../../base/i18n/functions';
import { setColorAlpha } from '../../../base/util/helpers';
import { openChat, setFocusedTab } from '../../../chat/actions.web';
import Chat from '../../../chat/components/web/Chat';
import { ChatTabs } from '../../../chat/constants';
import { isFileUploadingEnabled, processFiles } from '../../../file-sharing/functions.any';
import MainFilmstrip from '../../../filmstrip/components/web/MainFilmstrip';
import ScreenshareFilmstrip from '../../../filmstrip/components/web/ScreenshareFilmstrip';
import StageFilmstrip from '../../../filmstrip/components/web/StageFilmstrip';
import CalleeInfoContainer from '../../../invite/components/callee-info/CalleeInfoContainer';
import LargeVideo from '../../../large-video/components/LargeVideo.web';
import LobbyScreen from '../../../lobby/components/web/LobbyScreen';
import { getIsLobbyVisible } from '../../../lobby/functions';
import { getOverlayToRender } from '../../../overlay/functions.web';
import ParticipantsPane from '../../../participants-pane/components/web/ParticipantsPane';
import Prejoin from '../../../prejoin/components/web/Prejoin';
import { isPrejoinPageVisible } from '../../../prejoin/functions.web';
import ReactionAnimations from '../../../reactions/components/web/ReactionsAnimations';
import { toggleToolboxVisible } from '../../../toolbox/actions.any';
import { fullScreenChanged, showToolbox } from '../../../toolbox/actions.web';
import JitsiPortal from '../../../toolbox/components/web/JitsiPortal';
import Toolbox from '../../../toolbox/components/web/Toolbox';
import { LAYOUT_CLASSNAMES } from '../../../video-layout/constants';
import { getCurrentLayout } from '../../../video-layout/functions.any';
import VisitorsQueue from '../../../visitors/components/web/VisitorsQueue';
import { showVisitorsQueue } from '../../../visitors/functions';
import { init } from '../../actions.web';
import { maybeShowSuboptimalExperienceNotification } from '../../functions.web';

import {
    AbstractConference,
    type AbstractProps,
    abstractMapStateToProps
} from '../AbstractConference';

import ConferenceInfo from './ConferenceInfo';
import { default as Notice } from './Notice';

const FULL_SCREEN_EVENTS = [
    'webkitfullscreenchange',
    'mozfullscreenchange',
    'fullscreenchange'
];

interface IProps extends AbstractProps, WithTranslation {
    _backgroundAlpha?: number;
    _isAnyOverlayVisible: boolean;
    _layoutClassName: string;
    _mouseMoveCallbackInterval?: number;
    _overflowDrawer: boolean;
    _reducedUI: boolean;
    _roomName: string;
    _showLobby: boolean;
    _showPrejoin: boolean;
    _showVisitorsQueue: boolean;
    dispatch: IStore['dispatch'];
}

function shouldShowPrejoin({ _showLobby, _showPrejoin, _showVisitorsQueue }: IProps) {
    return _showPrejoin && !_showVisitorsQueue && !_showLobby;
}

class Conference extends AbstractConference<IProps, any> {
    _originalOnMouseMove: Function;
    _originalOnShowToolbar: Function;

    constructor(props: IProps) {
        super(props);

        const { _mouseMoveCallbackInterval } = props;

        this._originalOnShowToolbar = this._onShowToolbar;
        this._originalOnMouseMove = this._onMouseMove;

        this._onShowToolbar = throttle(
            () => this._originalOnShowToolbar(),
            100,
            { leading: true, trailing: false }
        );

        this._onMouseMove = throttle(
            event => this._originalOnMouseMove(event),
            _mouseMoveCallbackInterval,
            { leading: true, trailing: false }
        );

        this._onFullScreenChange = this._onFullScreenChange.bind(this);
        this._onVideospaceTouchStart = this._onVideospaceTouchStart.bind(this);
        this._setBackground = this._setBackground.bind(this);
    }

    override componentDidMount() {
        document.title = `${this.props._roomName} | ${interfaceConfig.APP_NAME}`;
        this._start();
    }

    override componentDidUpdate(prevProps: IProps) {
        if (this.props._shouldDisplayTileView === prevProps._shouldDisplayTileView) {
            return;
        }

        VideoLayout.refreshLayout();
    }

    override componentWillUnmount() {
        APP.UI.unbindEvents();

        FULL_SCREEN_EVENTS.forEach(name =>
            document.removeEventListener(name, this._onFullScreenChange));

        APP.conference.isJoined() && this.props.dispatch(hangup());
    }

    override render() {
        const {
            _isAnyOverlayVisible,
            _layoutClassName,
            _notificationsVisible,
            _overflowDrawer,
            _reducedUI,
            _showLobby,
            _showPrejoin,
            _showVisitorsQueue,
            t
        } = this.props;

        const isInConference =
            APP.conference?.isJoined?.() &&
            !_showPrejoin &&
            !_showLobby &&
            !_showVisitorsQueue;

        return (
            <div
                id='layout_wrapper'
                onMouseEnter={this._onMouseEnter}
                onMouseLeave={this._onMouseLeave}
                onMouseMove={this._onMouseMove}
                ref={this._setBackground}>

                <Chat />

                <div
                    className={_layoutClassName}
                    id='videoconference_page'
                    onMouseMove={isMobileBrowser() ? undefined : this._onShowToolbar}>

                    { _showPrejoin || _showLobby || <ConferenceInfo /> }

                    <Notice />

                    <div id='videospace' onTouchStart={this._onVideospaceTouchStart}>
                        <LargeVideo />
                        

                        { isInConference && (
                            <>
                                <StageFilmstrip />
                                <ScreenshareFilmstrip />
                                <MainFilmstrip />
                                
                            </>
                        )}

                    </div>

                    { isInConference && (
                        <>
                            <span aria-level={1} className='sr-only' role='heading'>
                                {t('toolbar.accessibilityLabel.heading')}
                            </span>
                            <Toolbox />
                        </>
                    )}

                    {_notificationsVisible && !_isAnyOverlayVisible &&
                        (_overflowDrawer
                            ? <JitsiPortal className='notification-portal'>
                                {this.renderNotificationsContainer({ portal: true })}
                              </JitsiPortal>
                            : this.renderNotificationsContainer())
                    }

                    <CalleeInfoContainer />

                    {shouldShowPrejoin(this.props) && <Prejoin />}
                    {_showLobby && !_showVisitorsQueue && <LobbyScreen />}
                    {_showVisitorsQueue && <VisitorsQueue />}
                </div>

                <ParticipantsPane />
                <ReactionAnimations />
                <StudentMonitor />
            </div>
        );
    }

    _setBackground(element: HTMLDivElement) {
        if (!element) return;

        if (this.props._backgroundAlpha !== undefined) {
            const elemColor = element.style.background;
            const alphaElemColor = setColorAlpha(elemColor, this.props._backgroundAlpha);
            element.style.background = alphaElemColor;

            if (element.parentElement) {
                const parentColor = element.parentElement.style.background;
                const alphaParentColor = setColorAlpha(parentColor, this.props._backgroundAlpha);
                element.parentElement.style.background = alphaParentColor;
            }
        }
    }

    _onVideospaceTouchStart() {
        this.props.dispatch(toggleToolboxVisible());
    }

    _onFullScreenChange() {
        this.props.dispatch(fullScreenChanged(APP.UI.isFullScreen()));
    }

    _onMouseEnter(event: React.MouseEvent) {
        APP.API.notifyMouseEnter(event);
    }

    _onMouseLeave(event: React.MouseEvent) {
        APP.API.notifyMouseLeave(event);
    }

    _onMouseMove(event: React.MouseEvent) {
        APP.API.notifyMouseMove(event);
    }

    _onShowToolbar() {
        this.props.dispatch(showToolbox());
    }

    _start() {
        APP.UI.start();
        APP.UI.bindEvents();

        FULL_SCREEN_EVENTS.forEach(name =>
            document.addEventListener(name, this._onFullScreenChange));

        const { dispatch, t } = this.props;

        dispatch(init(!shouldShowPrejoin(this.props)));
        maybeShowSuboptimalExperienceNotification(dispatch, t);
    }
}

function _mapStateToProps(state: IReduxState) {
    const { backgroundAlpha, mouseMoveCallbackInterval } = state['features/base/config'];
    const { overflowDrawer } = state['features/toolbox'];
    const { reducedUI } = state['features/base/responsive-ui'];

    return {
        ...abstractMapStateToProps(state),
        _backgroundAlpha: backgroundAlpha,
        _isAnyOverlayVisible: Boolean(getOverlayToRender(state)),
        _layoutClassName: LAYOUT_CLASSNAMES[getCurrentLayout(state) ?? ''],
        _mouseMoveCallbackInterval: mouseMoveCallbackInterval,
        _overflowDrawer: overflowDrawer,
        _reducedUI: reducedUI,
        _roomName: getConferenceNameForTitle(state),
        _showLobby: getIsLobbyVisible(state),
        _showPrejoin: isPrejoinPageVisible(state),
        _showVisitorsQueue: showVisitorsQueue(state)
    };
}

export default reactReduxConnect(_mapStateToProps)(translate(props => {
    const dispatch = useDispatch();
    const store = useStore();

    const [isDragging, setIsDragging] = useState(false);
    const { isOpen: isChatOpen } = useSelector((state: IReduxState) => state['features/chat']);
    const isFileUploadEnabled = useSelector(isFileUploadingEnabled);

    const handleDragEnter = useCallback(e => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback(e => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDragOver = useCallback(e => {
        e.preventDefault();

        if (isDragging && isFileUploadEnabled) {
            if (!isChatOpen) dispatch(openChat());
            dispatch(setFocusedTab(ChatTabs.FILE_SHARING));
        }
    }, [isChatOpen, isDragging, isFileUploadEnabled]);

    const handleDrop = useCallback(e => {
        e.preventDefault();
        setIsDragging(false);

        if (isFileUploadEnabled && e.dataTransfer.files?.length > 0) {
            processFiles(e.dataTransfer.files, store);
        }
    }, [isFileUploadEnabled]);

    return (
        <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}>
            <Conference {...props} />
        </div>
    );
}));

