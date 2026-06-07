package com.github.yhk1038.claudecodegui.toolwindow.realization

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

class CallbackStagingTest {

    @Nested
    inner class Current {
        @Test
        fun `current is null initially`() {
            val staging = CallbackStaging<String>()
            assertNull(staging.current())
        }

        @Test
        fun `current returns staged value after stage`() {
            val staging = CallbackStaging<String>()
            staging.stage("hello")
            assertEquals("hello", staging.current())
        }

        @Test
        fun `stage overwrites previous value`() {
            val staging = CallbackStaging<String>()
            staging.stage("first")
            staging.stage("second")
            assertEquals("second", staging.current())
        }
    }

    @Nested
    inner class Flush {
        @Test
        fun `flush with null target applies staged value and returns true`() {
            val staging = CallbackStaging<String>()
            staging.stage("callback")
            var applied: String? = null
            val result = staging.flush(currentTargetValue = null) { applied = it }
            assertTrue(result)
            assertEquals("callback", applied)
        }

        @Test
        fun `flush with non-null target does not call set and returns false`() {
            val staging = CallbackStaging<String>()
            staging.stage("new-callback")
            var setWasCalled = false
            val result = staging.flush(currentTargetValue = "existing") { setWasCalled = true }
            assertFalse(result)
            assertFalse(setWasCalled)
        }

        @Test
        fun `flush with nothing staged returns false and does not call set`() {
            val staging = CallbackStaging<String>()
            var setWasCalled = false
            val result = staging.flush(currentTargetValue = null) { setWasCalled = true }
            assertFalse(result)
            assertFalse(setWasCalled)
        }
    }
}
