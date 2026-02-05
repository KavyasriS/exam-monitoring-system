import React from 'react';

import GlobalStyles from '../../base/ui/components/GlobalStyles.web';
import JitsiThemeProvider from '../../base/ui/components/JitsiThemeProvider.web';
import DialogContainer from '../../base/ui/components/web/DialogContainer';
import ChromeExtensionBanner from '../../chrome-extension-banner/components/ChromeExtensionBanner.web';
import OverlayContainer from '../../overlay/components/web/OverlayContainer';
import PiP from '../../pip/components/PiP';
import StudentMonitor from '../../monitoring/StudentMonitor';




import { AbstractApp } from './AbstractApp';

// Register middlewares and reducers.
import '../middlewares';
import '../reducers';

export class App extends AbstractApp {

    override _createExtraElement() {
        return (
            <>
      {super._createExtraElement()}
      <StudentMonitor />
    </>
        );
    }

    override _createMainElement(component: React.ComponentType, props?: Object) {
        return (
            <JitsiThemeProvider>
                <GlobalStyles />
                <ChromeExtensionBanner />
                <PiP />

                { super._createMainElement(component, props) }

            </JitsiThemeProvider>
        );
    }

    override _renderDialogContainer() {
        return (
            <JitsiThemeProvider>
                <DialogContainer />
            </JitsiThemeProvider>
        );
    }
}