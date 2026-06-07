package com.github.yhk1038.claudecodegui.toolwindow.realization

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

class RealizationGateTest {

    @Nested
    inner class TryAcquire {
        @Test
        fun `first tryAcquire returns true`() {
            val gate = RealizationGate()
            assertTrue(gate.tryAcquire())
        }

        @Test
        fun `second tryAcquire returns false`() {
            val gate = RealizationGate()
            gate.tryAcquire()
            assertFalse(gate.tryAcquire())
        }

        @Test
        fun `subsequent calls after first all return false`() {
            val gate = RealizationGate()
            gate.tryAcquire()
            repeat(5) {
                assertFalse(gate.tryAcquire())
            }
        }
    }

    @Nested
    inner class IsAcquired {
        @Test
        fun `isAcquired is false before any call`() {
            val gate = RealizationGate()
            assertFalse(gate.isAcquired())
        }

        @Test
        fun `isAcquired is true after first tryAcquire`() {
            val gate = RealizationGate()
            gate.tryAcquire()
            assertTrue(gate.isAcquired())
        }

        @Test
        fun `isAcquired stays true after repeated tryAcquire calls`() {
            val gate = RealizationGate()
            gate.tryAcquire()
            gate.tryAcquire()
            gate.tryAcquire()
            assertTrue(gate.isAcquired())
        }
    }
}
