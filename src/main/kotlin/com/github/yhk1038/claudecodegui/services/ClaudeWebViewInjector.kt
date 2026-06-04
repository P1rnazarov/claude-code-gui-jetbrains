package com.github.yhk1038.claudecodegui.services

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Injects JavaScript into the pooled JCEF WebView for the given session so React can pick up
 * native-drop paths from IDE/Swing DnD. Uses the per-holder injection queue so calls made
 * before the WebView finishes loading are flushed once it does.
 */
object ClaudeWebViewInjector {

    private val logger = Logger.getInstance(ClaudeWebViewInjector::class.java)

    data class NativeDropEntry(val path: String, val isDirectory: Boolean)

    fun injectNativeDropEntries(project: Project, sessionId: String, entries: List<NativeDropEntry>) {
        if (entries.isEmpty()) return
        val entriesJson = Json.encodeToString(
            JsonElement.serializer(),
            buildJsonArray {
                entries.forEach { file ->
                    add(buildJsonObject {
                        put("path", file.path)
                        put("type", if (file.isDirectory) "folder" else "file")
                    })
                }
            },
        )
        val js = """
            (function() {
              const entries = $entriesJson;
              window.__CLAUDE_CODE_PENDING_DROP_ENTRIES__ = [
                ...(window.__CLAUDE_CODE_PENDING_DROP_ENTRIES__ || []),
                ...entries
              ];
              window.dispatchEvent(new CustomEvent('claude-code:native-drop-paths', {
                detail: { entries: entries }
              }));
            })();
        """.trimIndent()
        executeJavaScript(project, sessionId, js)
    }

    private fun executeJavaScript(project: Project, sessionId: String, js: String) {
        ApplicationManager.getApplication().invokeLater {
            try {
                val holder = ClaudeCodeBrowserService.getInstance(project).getOrCreate(sessionId)
                if (holder == null) {
                    logger.warn("Cannot inject JS into WebView: JCEF unavailable for session $sessionId")
                    return@invokeLater
                }
                holder.injectIdeJavaScriptWhenReady(js)
            } catch (e: Exception) {
                logger.warn("Failed to inject JS into WebView for session $sessionId", e)
            }
        }
    }
}
