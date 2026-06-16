package com.github.yhk1038.claudecodegui.hosting

import com.github.yhk1038.claudecodegui.editor.ClaudeCodeVirtualFile
import com.github.yhk1038.claudecodegui.services.EditorTabStateService
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project

/**
 * Hosts chat sessions in IDE **editor tabs** — the original behaviour, now
 * expressed through the [ChatHost] contract.
 *
 * The open/restore logic here was lifted verbatim from
 * `OpenClaudeCodeAction.openTab` and `EditorTabRestoreActivity`; the only change
 * is that the restart-restore ordering is now sourced from the pure
 * [ChatHostRouter.planRestoreOrder] so it can be unit-tested.
 */
object EditorTabHost : ChatHost {

    private val logger = Logger.getInstance(EditorTabHost::class.java)

    override fun openOrFocus(project: Project, tabId: String, initialPath: String?, initialTitle: String?) {
        // Must run on the EDT (the platform resolves the active splitter via the
        // focus owner). requestOpenFile itself does NOT block — see [doOpenOrFocus].
        ApplicationManager.getApplication().invokeLater {
            doOpenOrFocus(project, tabId, initialPath, initialTitle)
        }
    }

    /**
     * Opens-or-focuses the tab without freezing the EDT.
     *
     * The deprecated synchronous `openFile(file, focusEditor)` ran
     * `blockingWaitForCompositeFileOpen`, pumping the EDT until the whole
     * composite (our JCEF panel) was ready — which froze the IDE for 60–85s on
     * startup tab restore (#110). Merely wrapping that call in `invokeLater` did
     * NOT help (it still blocked the EDT — the v0.8.3 regression).
     *
     * `requestOpenFile` opens with `waitForCompositeOpen = false`, so the EDT
     * only does the cheap composite creation and never waits for the heavy load.
     * It is a public `@ApiStatus.Experimental` API, so this stays clear of any
     * `@ApiStatus.Internal` type (notably `FileEditorOpenOptions`). The tab is
     * still made current (`selectAsCurrent`); keyboard focus is taken by the
     * WebView itself in `ClaudeCodePanel` once it is showing.
     */
    private fun doOpenOrFocus(project: Project, tabId: String, initialPath: String?, initialTitle: String?) {
        val fileEditorManager = FileEditorManager.getInstance(project)
        val virtualFile = ClaudeCodeVirtualFile.getOrCreate(project, tabId, initialPath, initialTitle)

        // Already-open tab (same cached virtual file) → focus; otherwise open a new one.
        fileEditorManager.requestOpenFile(virtualFile)

        // Persist tab state.
        EditorTabStateService.getInstance(project).addTab(tabId)
    }

    override fun restorePersistedSessions(project: Project) {
        val stateService = EditorTabStateService.getInstance(project)
        val tabIds = stateService.getOpenTabIds()

        if (tabIds.isEmpty()) {
            logger.info("No saved editor tabs to restore")
            return
        }

        val activeTabId = stateService.getActiveTabId()
        val restoreOrder = ChatHostRouter.planRestoreOrder(tabIds, activeTabId)

        logger.info("Restoring ${tabIds.size} editor tab(s): $tabIds")

        ApplicationManager.getApplication().invokeLater {
            // Inactive tabs first (original order), active tab last so it wins focus.
            for (tabId in restoreOrder) {
                doOpenOrFocus(
                    project,
                    tabId,
                    stateService.getRestorePath(tabId),
                    stateService.getTitle(tabId)
                )
            }
            logger.info("Editor tabs restored successfully")
        }
    }
}
