package com.github.yhk1038.claudecodegui.toolwindow.realization

/**
 * The sequential phases shown in the panel's placeholder label while the JCEF browser
 * is not yet realized. Each phase carries an English [message] string suitable for
 * display directly in the UI.
 */
enum class LoadingPhase(val message: String) {
    INDEXING_WAIT("Waiting for project indexing..."),
    BACKEND_START("Starting backend..."),
}
