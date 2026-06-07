package com.github.yhk1038.claudecodegui.toolwindow.realization

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class LoadingPhaseTest {

    @Test
    fun `INDEXING_WAIT carries expected message`() {
        assertEquals("Waiting for project indexing...", LoadingPhase.INDEXING_WAIT.message)
    }

    @Test
    fun `BACKEND_START carries expected message`() {
        assertEquals("Starting backend...", LoadingPhase.BACKEND_START.message)
    }
}
